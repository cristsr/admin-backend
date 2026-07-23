# EP-2 — API REST (Fase 2)

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo contiene el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-2.1** Contrato OpenAPI inicial + versionado del API (RNF-8).
- **EP-2.2** Adaptador HTTP driving: controllers → command bus / query bus.
- **EP-2.3** Contexto autenticado externo (`user_id`, `client_id`) vía guard/middleware (RF-26).
- **EP-2.4** Endpoints de cuentas: `/ledger/initialize`, `/accounts`.
- **EP-2.5** Endpoints de transacciones: crear/listar/`confirm`/`void`/`amend`/`annotate`/`reverse`.
- **EP-2.6** Códigos de error de dominio estables (RF-14) vía exception filter.
- **EP-2.7** Read-your-writes (RNF-9) + idempotencia por `external_ref` (RF-11).

---

## Plan detallado

### 0. Principios rectores de la épica

EP-2 es **exclusivamente el adaptador conductor (driving) HTTP** del hexágono
(§3.7). No introduce lógica de dominio ni de aplicación: se apoya en los buses y
puertos que EP-1 ya expone. Reglas duras que gobiernan todo el código de esta
épica:

1. **RNF-10 (segregación CQRS estricta)**: un controller traduce HTTP → command
   bus (escrituras) o query bus (lecturas) y nada más. Prohibido en un controller:
   validar invariantes, reconstruir agregados, tocar el `EventStore`, leer
   proyecciones para decidir una escritura, o transformar datos con reglas de
   negocio. La única lógica permitida es *mapeo de forma* (DTO ↔ command/query,
   read model → response DTO).
2. **RNF-11 (aislamiento hexagonal)**: el núcleo (Domain + Application) no conoce
   NestJS. Todo lo de EP-2 vive en `infrastructure/adapters/http` de cada módulo.
3. **RF-26**: ninguna petición se procesa sin contexto autenticado (`user_id`,
   `client_id`) resuelto por infraestructura externa. Sin contexto válido → 401.
4. **Reuso de plataforma** (estrategia de convivencia del roadmap): se reutiliza
   `libs/shared` — `ExceptionFilter`, jerarquía `DomainException`, patrón de
   guards, `CriteriaQueryDto`, `configValidator` + `registerAs`, telemetría OTel,
   Swagger builder. **No** se reutiliza el dominio de `finances`.
5. **Idempotencia en el stream, no en HTTP**: a diferencia de `finances`, que usa
   un `IdempotencyInterceptor` con tabla propia
   (`apps/finances/src/idempotency/infrastructure/adapters/http/idempotency.interceptor.ts`),
   el ledger delega la idempotencia al puerto `EventStore` vía `external_ref`
   (INV-10, §3.8). EP-2 **no** replica ese interceptor: solo extrae el
   `external_ref` de la petición y lo pasa al command; el resto lo garantiza EP-1.

### Estructura hexagonal de la app (contexto EP-0/EP-1, referencia)

```
apps/ledger/src/
  main.ts                         # bootstrap: versioning, global filter, swagger
  app.module.ts
  config/
    environment/                  # @ledger config (registerAs + class-validator)
    swagger/                      # ledger-swagger.builder.ts (EP-2.1)
  shared-kernel/
    infrastructure/adapters/http/ # LedgerContextGuard, @Context, filter, base DTOs
  accounts/
    domain/ application/          # EP-1 (buses, handlers, aggregates)
    infrastructure/adapters/http/ # EP-2.4
  transactions/
    domain/ application/          # EP-1
    infrastructure/adapters/http/ # EP-2.5
```

Alias de paths: `@ledger/*` (definido en EP-0.1). Los controllers importan de
`@ledger/accounts/application/...` (buses, commands, queries, DTOs de aplicación)
y de `@shared` (plataforma).

---

## EP-2.1 — Contrato OpenAPI inicial + versionado del API (RNF-8)

### Objetivo
Establecer el esqueleto OpenAPI generado desde el código y fijar la política de
versionado estable del contrato (RNF-8), antes de escribir endpoints.

### Archivos a crear
- `apps/ledger/src/config/swagger/ledger-swagger.builder.ts` — espejo de
  `apps/finances/src/config/swagger/swagger.builder.ts`: `DocumentBuilder` con
  título, versión, esquemas de seguridad y `maybeMountSwagger`.
- `apps/ledger/src/config/swagger/index.ts`.
- Ajuste de `apps/ledger/src/main.ts` (creado en EP-0): habilitar versionado URI
  y montar swagger.

### Decisión de versionado (RNF-8)
- **Versionado por URI**: prefijo global `api` + `VersioningType.URI` con
  `defaultVersion: '1'`. Todos los recursos cuelgan de `/api/v1/...`.
- Se elige URI sobre header/media-type porque es el más explícito para clientes
  heterogéneos (frontend, sistema de correos) y el más simple de enrutar en un
  gateway. Un cambio incompatible abre `/api/v2` conviviendo con `/api/v1`
  (los controllers se anotan `@Version('2')` selectivamente).
- La versión del **contrato** (`DocumentBuilder.setVersion`) es semver del
  documento OpenAPI y evoluciona de forma aditiva mientras el major de la URI no
  cambie.

### Firma clave (main.ts)
```ts
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

### Esquemas de seguridad OpenAPI
Se declaran dos, alineados con la pregunta abierta #5 (ver Decisiones abiertas):
`bearerAuth` (JWT del servicio de identidad) y `gatewayContext` (headers de
contexto firmados por el gateway). El esqueleto de paths va al final de este
documento.

### Criterios de aceptación
- `GET /api/v1/docs` sirve la UI Swagger fuera de producción.
- Todos los endpoints resuelven bajo `/api/v1`.
- El documento declara los esquemas de seguridad y los aplica globalmente.

### Estimación: **S**

---

## EP-2.2 — Adaptador HTTP driving: controllers → command bus / query bus

### Objetivo
Definir el patrón canónico con el que **cualquier** controller del ledger
traduce HTTP a los buses de EP-1, sin lógica de dominio (RNF-10). Es la plantilla
que EP-2.4 y EP-2.5 instancian.

### Puertos de EP-1 en los que se apoya (referencia, no se crean aquí)
```ts
/** Bus de escritura. Resuelve el handler, aplica idempotencia/contexto/concurrencia. */
export abstract class CommandBus {
  abstract dispatch<TResult extends CommandResult>(command: LedgerCommand): Promise<TResult>;
}

/** Bus de lectura. Solo proyecciones; sin dominio ni event store (RNF-10). */
export abstract class QueryBus {
  abstract ask<TResult>(query: LedgerQuery): Promise<TResult>;
}

/**
 * Lo único que un command retorna (RNF-10): identificadores generados y la
 * posición de stream alcanzada para read-your-writes (RNF-9). Nunca una vista.
 */
export interface CommandResult {
  readonly aggregateId: string;
  readonly sequence: number;
  readonly streamPosition: number;
  /** true si fue un replay idempotente por external_ref (INV-10). */
  readonly idempotentReplay: boolean;
}
```

### Patrón de controller (firma canónica)
Un command se construye a partir de tres fuentes disjuntas y se despacha; no hay
más lógica:
```ts
@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async open(
    @Context() context: LedgerContext,          // RF-26 (EP-2.3)
    @ExternalRef() externalRef: Nullable<string>, // RF-11 (EP-2.7)
    @Body() dto: OpenAccountRequestDto,
  ): Promise<CommandAcceptedDto> {
    const command = new OpenAccountCommand({
      ...context,          // userId, clientId
      externalRef,
      type: dto.type,
      name: dto.name,
      currencies: dto.currencies,
      openedOn: dto.openedOn,
    });

    const result = await this.commandBus.dispatch<CommandResult>(command);
    return CommandAcceptedDto.from(result); // { id, sequence, streamPosition }
  }

  @Get()
  async list(
    @Context() context: LedgerContext,
    @Query() query: AccountTreeQueryDto,
  ): Promise<AccountTreeDto> {
    return this.queryBus.ask<AccountTreeDto>(
      new AccountTreeQuery({ userId: context.userId, view: query.view }),
    );
  }
}
```

Puntos no negociables del patrón:
- El controller **no** conoce agregados ni eventos: solo commands/queries de
  aplicación.
- Escrituras retornan `CommandAcceptedDto` (id + `sequence` + `streamPosition`),
  **jamás** una representación de lectura (RNF-10). Si el cliente quiere ver el
  recurso, hace un `GET` posterior (read-your-writes garantizado por EP-2.7).
- Lecturas retornan DTOs derivados de read models, sin efectos secundarios.

### Archivos a crear (plantilla compartida, `shared-kernel`)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/dto/command-accepted.dto.ts`
  — DTO de respuesta estándar de toda escritura.
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/dto/index.ts`.
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/index.ts`.

### `CommandAcceptedDto`
```ts
export class CommandAcceptedDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly sequence: number;
  @ApiProperty({ description: 'Global stream position for read-your-writes (RNF-9).' })
  readonly streamPosition: number;

  static from(result: CommandResult): CommandAcceptedDto { /* map */ }
}
```

### Plan TDD
- Test de wiring (`app.wiring.spec.ts`, espejo de
  `apps/finances/src/app.wiring.spec.ts`): cada controller resuelve sus
  dependencias (`CommandBus`, `QueryBus`) del contenedor.
- Test de controller con buses mockeados:
  - `AccountsController.open dispatches an OpenAccountCommand built from body + context`.
  - `AccountsController.open returns id, sequence and streamPosition, never a read view`.
  - `AccountsController.list asks the query bus and returns the projection unchanged`.
  - `no controller method reads the EventStore or a repository` (verificable por
    ausencia de dependencias en el constructor).

### Criterios de aceptación
- Existe un patrón único y probado controller → bus.
- Ninguna escritura devuelve una vista de lectura.
- Los controllers dependen solo de `CommandBus`/`QueryBus` (+ decoradores de
  contexto), nunca de puertos de infraestructura.

### Dependencias: EP-1.8 (command bus + handlers), EP-1.11 (query bus).
### Estimación: **M**

---

## EP-2.3 — Contexto autenticado externo (`user_id`, `client_id`) — RF-26

### Objetivo
Exigir y resolver en toda petición el contexto autenticado `(user_id, client_id)`
provisto por infraestructura externa, e inyectarlo en los controllers de forma
declarativa. Rechazar (401) toda petición sin contexto válido.

### Modelo conceptual (spec §2.10, §2.11, §4.2)
- `user_id`: dueño del ledger; particiona todo (INV-9).
- `client_id`: procedencia opaca (frontend, correos, automatizador). El ledger
  **no** valida ni administra identidad de clientes: solo exige presencia y la
  registra como metadata (RF-12).
- La autenticación/autorización reales viven en un servicio externo; el ledger
  confía en el contexto ya resuelto.

### Diseño: puerto + guard + param decorator (reusa el patrón de `finances`)
Se sigue el estilo de `libs/shared/src/auth/guards/jwt-auth.guard.ts` +
`libs/shared/src/decorators/current-user.decorator.ts` +
`libs/shared/src/functions/extract-user-from-context.ts`, pero desacoplado del
mecanismo concreto para no atarnos a la pregunta abierta #5.

### Archivos a crear
- `apps/ledger/src/shared-kernel/domain/context/ledger-context.type.ts`
- `apps/ledger/src/shared-kernel/application/ports/ledger-context-resolver.ts` (puerto)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/ledger-context.guard.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/context.decorator.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/resolvers/gateway-header-context.resolver.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/resolvers/jwt-context.resolver.ts` (alternativa)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/index.ts`

### Firmas clave
```ts
/** El contexto que viaja hacia cada command/query y se registra en cada evento. */
export interface LedgerContext {
  readonly userId: string;
  readonly clientId: string;
}

/**
 * Puerto: traduce una request a un LedgerContext. Abstrae el mecanismo concreto
 * (headers firmados del gateway / JWT / mTLS) — decisión diferida (pregunta #5).
 * Abstract class, no interface, para servir como token de inyección (convención TS).
 */
export abstract class LedgerContextResolver {
  abstract resolve(request: HttpRequest): Nullable<LedgerContext>;
}

/** Adaptador por defecto en desarrollo: el gateway inyecta headers de confianza. */
@Injectable()
export class GatewayHeaderContextResolver extends LedgerContextResolver {
  resolve(request: HttpRequest): Nullable<LedgerContext> {
    const userId = request.headers['x-user-id'];
    const clientId = request.headers['x-client-id'];
    if (!userId || !clientId) return null; // guard clause
    return { userId, clientId };
  }
}

@Injectable()
export class LedgerContextGuard implements CanActivate {
  constructor(private readonly resolver: LedgerContextResolver) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const request = executionContext.switchToHttp().getRequest<HttpRequest>();
    const context = this.resolver.resolve(request);
    if (!context) {
      throw new UnauthorizedException('Missing or invalid authenticated context'); // RF-26
    }
    request.ledgerContext = context; // el decorador lo lee después
    return true;
  }
}

/** Inyección declarativa análoga a @CurrentUser() de shared. */
export const Context = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): LedgerContext =>
    ctx.switchToHttp().getRequest().ledgerContext,
);
```

- El guard se registra **global** (`APP_GUARD`) en `app.module.ts`, de modo que
  todo endpoint exige contexto por defecto; un endpoint infra (health) se marca
  `@Public()` (reusa `libs/shared/src/decorators/public.decorator.ts` +
  `IS_PUBLIC`).
- El resolver es intercambiable por binding de módulo:
  `{ provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver }`.
  Cambiar a JWT es reemplazar el provider, cero cambios en controllers (RNF-11).

### Propagación a eventos (RF-12)
El `LedgerContext` entra como parte de cada command; el command handler (EP-1.8)
lo copia al envelope del evento (`user_id`, `client_id`). EP-2 solo lo transporta
hasta el command.

### Plan TDD
- `LedgerContextGuard rejects a request without x-user-id (401)`.
- `LedgerContextGuard rejects a request without x-client-id (401)`.
- `LedgerContextGuard attaches a LedgerContext to the request when both are present`.
- `@Context() decorator returns the resolved context in the handler`.
- `a @Public() endpoint bypasses the context guard`.
- e2e: `POST /api/v1/accounts without context headers responds 401`.

### Criterios de aceptación
- Ninguna ruta de negocio se ejecuta sin `(user_id, client_id)` válidos.
- El `client_id` llega hasta el command sin interpretación.
- El mecanismo concreto es un adaptador reemplazable (pregunta #5 no bloquea EP-2).

### Dependencias: EP-2.2. ### Riesgo: pregunta abierta #5 sin cerrar — mitigada por el puerto.
### Estimación: **M**

---

## EP-2.4 — Endpoints de cuentas: `/ledger/initialize`, `/accounts`

### Objetivo
Exponer el ciclo de vida de cuentas y la inicialización del ledger, mapeando a
los commands `InitializeLedger`, `OpenAccount`, `RenameAccount`, `CloseAccount`
y a las queries `account_tree` / `account_balances` (§7).

### Archivos a crear
- `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts`
- `apps/ledger/src/accounts/infrastructure/adapters/http/ledger.controller.ts` (initialize + settings-read)
- `apps/ledger/src/accounts/infrastructure/adapters/http/dto/`:
  - `initialize-ledger-request.dto.ts`
  - `open-account-request.dto.ts`
  - `rename-account-request.dto.ts`
  - `close-account-request.dto.ts`
  - `account-tree-query.dto.ts` (view: `tree | flat`)
  - `account.dto.ts`, `account-tree.dto.ts`, `account-balance.dto.ts` (responses)
  - `index.ts`
- `apps/ledger/src/accounts/infrastructure/adapters/http/index.ts`

### Endpoints (verbo + ruta + command/query + request/response)

| Verbo | Ruta | Command/Query | Request (resumen) | Response |
|---|---|---|---|---|
| POST | `/api/v1/ledger/initialize` | `InitializeLedger` | `{ presentationCurrency, timezone }` + `external_ref` | `201 CommandAcceptedDto` |
| GET | `/api/v1/ledger/settings` | query `proj_ledger_settings` | — | `200 LedgerSettingsDto` |
| POST | `/api/v1/accounts` | `OpenAccount` | `{ type, name, parentId?, currencies[], openedOn, isBankMirror }` + `external_ref` | `201 CommandAcceptedDto` |
| GET | `/api/v1/accounts` | query `account_tree` | `?view=tree\|flat` | `200 AccountTreeDto` |
| GET | `/api/v1/accounts/{id}` | query `account_tree` (single) | — | `200 AccountDto` |
| GET | `/api/v1/accounts/{id}/balance` | query `account_balances` | `?currency?` | `200 AccountBalanceDto[]` (confirmed/pending por moneda) |
| POST | `/api/v1/accounts/{id}/rename` | `RenameAccount` | `{ newName }` + `external_ref` | `200 CommandAcceptedDto` |
| POST | `/api/v1/accounts/{id}/close` | `CloseAccount` | `{ closedOn }` + `external_ref` | `200 CommandAcceptedDto` |

Notas:
- **`rename`/`close` como sub-recursos POST** (acciones), no `PATCH`/`DELETE`:
  una cuenta no se borra ni se hace un merge parcial; son transiciones de ciclo
  de vida event-sourced. Consistente con el estilo de acciones de transacciones.
- `GET /ledger/settings` es lectura pura; las mutaciones de settings
  (`ChangePresentationCurrency`, `ChangeTimezone`) pertenecen a EP-4.1 y se
  omiten aquí.
- El balance nunca se escribe (INV-5); `GET .../balance` es solo proyección.

### DTOs — validación (class-validator + Swagger), montos como string (INV-8/RNF-2)
```ts
export class OpenAccountRequestDto {
  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  readonly type: AccountType; // ASSETS | LIABILITIES | INCOME | EXPENSES | EQUITY

  @ApiProperty({ example: 'Assets:Bancolombia:Savings' })
  @IsString() @IsNotEmpty()
  readonly name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  readonly parentId?: string;

  @ApiProperty({ type: [String], example: ['COP'] })
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  readonly currencies: string[];

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString() // fecha contable plana, sin zona (RNF-7)
  readonly openedOn: string;

  @ApiProperty()
  @IsBoolean()
  readonly isBankMirror: boolean;
}
```
- El DTO **no** valida reglas de dominio (jerarquía, colisión de nombre,
  mono-moneda de cuentas reales, protección de cuentas de sistema): eso lo hacen
  los agregados de EP-1. El DTO solo valida **forma** (tipos, formato, presencia).

### Plan TDD (e2e + controller)
Controller (buses mockeados):
- `POST /accounts dispatches OpenAccountCommand with body + context + external_ref`.
- `POST /accounts/{id}/rename dispatches RenameAccountCommand with the path id`.
- `GET /accounts asks AccountTreeQuery scoped to the context user`.
- `GET /accounts/{id}/balance asks AccountBalancesQuery`.

e2e (con in-memory EventStore + proyecciones síncronas, harness EP-0.4):
- `POST /ledger/initialize creates technical accounts and returns 201 with stream position`.
- `POST /accounts opens an account and it appears in GET /accounts (read-your-writes)`.
- `POST /accounts with a duplicate name responds 409 NAME_COLLISION`.
- `POST /accounts/{systemId}/close responds 409 SYSTEM_ACCOUNT_PROTECTED`.
- `POST /accounts on a closed parent / bad currency surfaces the proper stable code`.
- `POST /accounts replayed with the same external_ref returns the original result (idempotent)`.

### Criterios de aceptación
- Un cliente inicializa su ledger y ejecuta apertura/renombre/cierre y consulta
  árbol y saldo, todo autenticado.
- Los errores de dominio salen con código estable (EP-2.6).
- Read-your-writes: lo recién creado es visible en el `GET` siguiente.

### Dependencias: EP-1.6 (agregado Account), EP-1.8 (handlers), EP-1.10/1.11
(proyección `account_tree`/`account_balances` + query bus), EP-2.2, EP-2.3.
### Estimación: **L**

---

## EP-2.5 — Endpoints de transacciones

### Objetivo
Exponer el ciclo de vida completo de transacciones (§4.1, flujos §7.1–§7.4)
mapeando a `RecordTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`,
`ConfirmTransaction`, `VoidPendingTransaction`, `ReverseConfirmedTransaction` y a
la query `transaction_list` con filtros (incl. payee) y paginación (RF-13).

### Archivos a crear
- `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`
- `apps/ledger/src/transactions/infrastructure/adapters/http/dto/`:
  - `record-transaction-request.dto.ts` (+ `posting.dto.ts`)
  - `amend-transaction-request.dto.ts`
  - `annotate-transaction-request.dto.ts`
  - `confirm-transaction-request.dto.ts`
  - `void-transaction-request.dto.ts`
  - `reverse-transaction-request.dto.ts`
  - `transaction-query.dto.ts` (filtros + paginación)
  - `transaction.dto.ts`, `transaction-list.dto.ts` (responses)
  - `index.ts`
- `apps/ledger/src/transactions/infrastructure/adapters/http/index.ts`

### Endpoints

| Verbo | Ruta | Command/Query | Request (resumen) | Response |
|---|---|---|---|---|
| POST | `/api/v1/transactions` | `RecordTransaction` | `{ date, payee?, description, status: PENDING\|CONFIRMED, postings[], invoiceUrl?, tags?, metadata? }` + `external_ref` | `201 CommandAcceptedDto` |
| GET | `/api/v1/transactions` | query `transaction_list` | filtros (`account`, `period`, `status`, `derivedKind`, `payee`, `clientId`) + `limit`/`offset` | `200 TransactionListDto` (page) |
| GET | `/api/v1/transactions/{id}` | query `transaction_list` (single) | — | `200 TransactionDto` |
| POST | `/api/v1/transactions/{id}/amend` | `AmendPendingTransaction` | `{ postings?, date? }` + `external_ref` | `200 CommandAcceptedDto` |
| POST | `/api/v1/transactions/{id}/annotate` | `AnnotateTransaction` | `{ payee?, description?, invoiceUrl?, tags?, metadata? }` + `external_ref` | `200 CommandAcceptedDto` |
| POST | `/api/v1/transactions/{id}/confirm` | `ConfirmTransaction` | `{ postings? }` + `external_ref` | `200 CommandAcceptedDto` |
| POST | `/api/v1/transactions/{id}/void` | `VoidPendingTransaction` | `{ reason }` + `external_ref` | `200 CommandAcceptedDto` |
| POST | `/api/v1/transactions/{id}/reverse` | `ReverseConfirmedTransaction` | `{ reason? }` + `external_ref` | `201 CommandAcceptedDto` (id de la reversa) |

Notas de diseño de contrato:
- **Sub-recursos de acción** (`/amend`, `/confirm`, ...) en vez de un `PATCH`
  genérico: cada transición es un command distinto con invariantes distintos
  (INV-6: enmienda solo en `PENDING`, anotación en cualquier estado no `VOIDED`,
  reversa solo en `CONFIRMED`). Un verbo por transición hace el contrato
  autodocumentado y evita que el servidor "adivine" la intención.
- `reverse` retorna el id de la **transacción de reversa** creada (T2), con
  `metadata.reverses_id = {id}` (§7.3); la original queda inmutable en el stream.
- `derivedKind` es filtro de **lectura** servido por la proyección (el proyector
  lo calcula, RF-4); el cliente nunca lo envía al crear.

### DTOs — postings con montos decimales string (INV-8, §8.1)
```ts
export class PostingDto {
  @ApiProperty() @IsUUID()
  readonly accountId: string;

  /** Decimal string, nunca number (INV-8: TS number es float). */
  @ApiProperty({ example: '-31900' })
  @IsNumberString() // valida decimal exacto; Money lo reconstruye en el dominio
  readonly amount: string;

  @ApiProperty({ example: 'COP' })
  @IsString() @IsNotEmpty()
  readonly currency: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional() @IsObject()
  readonly metadata?: Record<string, unknown>;
}

export class RecordTransactionRequestDto {
  @ApiProperty({ example: '2026-07-20' })
  @IsDateString()
  readonly date: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  readonly payee?: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  readonly description: string;

  @ApiProperty({ enum: TransactionStatus }) // PENDING | CONFIRMED
  @IsEnum(TransactionStatus)
  readonly status: TransactionStatus;

  @ApiProperty({ type: [PostingDto] })
  @IsArray() @ArrayMinSize(2)          // pista de forma para INV-2; el agregado es la autoridad
  @ValidateNested({ each: true }) @Type(() => PostingDto)
  readonly postings: PostingDto[];

  @ApiPropertyOptional() @IsOptional() @IsUrl()
  readonly invoiceUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  readonly tags?: string[];
}
```
- El balanceo a cero por moneda (INV-1) **no** se valida en el DTO: lo verifica el
  agregado `LedgerTransaction` (EP-1.7) y falla con `UNBALANCED_TRANSACTION`. El
  `ArrayMinSize(2)` es solo una malla de forma temprana; la autoridad de INV-2 es
  el dominio.

### Filtros y paginación (RF-13)
Se reutiliza el contrato de criteria de shared
(`libs/shared/src/criteria/criteria-query.dto.ts`, ver `MovementController` en
`apps/finances/.../movement.controller.ts`) **o** un `TransactionQueryDto`
específico con campos tipados (`account`, `period`, `status`, `payee`,
`derivedKind`, `clientId`, `limit`, `offset`). Recomendación: DTO específico
tipado por claridad del contrato OpenAPI y por acoplar el filtro al read model;
el query handler traduce a la consulta de la proyección `transaction_list`. El
controller **no** arma SQL ni criteria de dominio: pasa el query al bus.

### Plan TDD
Controller (buses mockeados):
- `POST /transactions dispatches RecordTransactionCommand with postings and status`.
- `POST /transactions/{id}/confirm dispatches ConfirmTransactionCommand with path id`.
- `POST /transactions/{id}/amend dispatches AmendPendingTransactionCommand`.
- `POST /transactions/{id}/annotate dispatches AnnotateTransactionCommand`.
- `POST /transactions/{id}/reverse returns the reversal transaction id`.
- `GET /transactions forwards filters and pagination to the query bus`.

e2e (in-memory, proyecciones síncronas):
- `POST /transactions with unbalanced postings responds 422 UNBALANCED_TRANSACTION`.
- `POST /transactions with a single posting responds 422 (INV-2)`.
- `POST /transactions then GET /transactions/{id} shows it (read-your-writes)`.
- `POST /transactions/{id}/amend on a CONFIRMED responds 409 IMMUTABLE_TRANSACTION`.
- `POST /transactions/{id}/void on a CONFIRMED responds 409 (only PENDING can be voided)`.
- `POST /transactions with a posting on a closed account responds 409 ACCOUNT_CLOSED`.
- `POST /transactions with a currency the account doesn't allow responds 422 CURRENCY_NOT_ALLOWED`.
- `POST /transactions replayed with same external_ref returns the original result`.
- `GET /transactions?payee=Netflix returns only matching transactions`.
- `GET /transactions?status=PENDING paginates with limit/offset`.

### Criterios de aceptación
- Ciclo de vida completo de transacción vía HTTP (registrar → confirmar; enmendar
  pendiente; anotar en cualquier estado; anular pendiente; revertir confirmada).
- Filtros por cuenta/período/estado/tipo derivado/payee/client_id con paginación.
- Todos los errores de dominio con código estable; read-your-writes garantizado.

### Dependencias: EP-1.7 (agregado), EP-1.8 (handlers), EP-1.10/1.11
(`transaction_list` + query bus), EP-2.2, EP-2.3, EP-2.6, EP-2.7.
### Estimación: **L**

---

## EP-2.6 — Códigos de error de dominio estables (RF-14) vía exception filter

### Objetivo
Garantizar que todo fallo de dominio o de puerto se reporte con un **código
estable y accionable** (RF-14) y un status HTTP consistente, con un cuerpo de
error uniforme.

### Estrategia: reusar la plataforma de `finances`, sin reinventar
`libs/shared` ya trae la maquinaria completa:
- `libs/shared/src/filters/exception.filter.ts`: `@Catch()` global que ya lee
  `exception.code` y `exception.status` de cualquier `DomainException` y produce
  `ErrorResponseBody` (`libs/shared/src/filters/error-response-body.type.ts`:
  `{ statusCode, error, message, code, path, timestamp }`).
- Jerarquía `DomainException` (`domain.exception.ts` → `status` + `code`),
  con `DomainConflictException` (409), `DomainUnprocessableException` (422),
  `DomainNotFoundException` (404).

Por tanto EP-2.6 **no escribe un filter nuevo**: registra el `ExceptionFilter`
de shared global en `apps/ledger/src/main.ts` y asegura que las excepciones del
ledger expongan los códigos RF-14. Dos familias:

1. **Excepciones de agregado (dominio, EP-1)** — subclases de `DomainException`
   con el `code` estable. Autoradas en EP-1 pero **su código estable es
   contrato del API (EP-2)**: esta subtarea define y verifica el mapeo.
2. **Excepciones de puerto (`EventStore`, EP-1.5)** — `CONCURRENCY_CONFLICT` y
   `DUPLICATE_EXTERNAL_REF` nacen en el adaptador de infraestructura, no en un
   agregado. Deben extender también la jerarquía `DomainException` (o una
   `LedgerConflictException` equivalente) para que el mismo filter las mapee sin
   un `catch` especial.

### Mapeo estable RF-14 → HTTP (contrato del API)

| `code` (RF-14) | HTTP | Origen | Excepción sugerida |
|---|---|---|---|
| `UNBALANCED_TRANSACTION` | 422 Unprocessable Entity | Agregado `LedgerTransaction` (INV-1) | `UnbalancedTransactionException` |
| `ACCOUNT_CLOSED` | 409 Conflict | Agregado `LedgerTransaction`/`Account` (INV-3) | `AccountClosedException` |
| `CURRENCY_NOT_ALLOWED` | 422 Unprocessable Entity | Agregado (INV-4) | `CurrencyNotAllowedException` |
| `DUPLICATE_EXTERNAL_REF` | 409 Conflict | Puerto `EventStore` (INV-10, colisión real) | `DuplicateExternalRefException` |
| `IMMUTABLE_TRANSACTION` | 409 Conflict | Agregado `LedgerTransaction` (INV-6) | `ImmutableTransactionException` |
| `CONCURRENCY_CONFLICT` | 409 Conflict | Puerto `EventStore` (INV-7) | `ConcurrencyConflictException` |
| `NAME_COLLISION` | 409 Conflict | Agregado `Account` (§2.1.1) | `NameCollisionException` |
| `SYSTEM_ACCOUNT_PROTECTED` | 409 Conflict | Agregado `Account` (INV-13) | `SystemAccountProtectedException` |
| `TRANSACTION_NOT_FOUND` / `ACCOUNT_NOT_FOUND` | 404 Not Found | Handler (load agregado inexistente) | `DomainNotFoundException` |
| `LEDGER_NOT_INITIALIZED` | 409 Conflict | Handler (operar sin `InitializeLedger`) | `LedgerNotInitializedException` |
| (contexto ausente) | 401 Unauthorized | `LedgerContextGuard` (RF-26) | `UnauthorizedException` (Nest) |
| (forma inválida DTO) | 400 Bad Request | `ValidationPipe` | (Nest) |

Racional de status:
- **422** para violaciones semánticas del contenido enviado que son
  *reprocesables corrigiendo el payload* (desbalance, moneda no permitida).
- **409** para conflictos de **estado**: la operación es válida en forma pero
  choca con el estado actual del agregado/stream (cuenta cerrada, transacción
  inmutable, colisión de nombre, cuenta de sistema protegida, concurrencia,
  `external_ref` en colisión real).

> **Sutileza de `DUPLICATE_EXTERNAL_REF` vs. idempotencia (INV-10):** un *replay*
> del **mismo** command con el **mismo** `external_ref` **no es un error**: el
> `EventStore` retorna el resultado original y el API responde `200` con el mismo
> `CommandAcceptedDto` (misma `streamPosition`). `DUPLICATE_EXTERNAL_REF` (409)
> se reserva para el caso patológico: mismo `external_ref` con un command
> **distinto/conflictivo**. Esta distinción la resuelve EP-1 en `append`; EP-2
> solo la traduce a HTTP.

### Archivos a crear/tocar
- `apps/ledger/src/main.ts`: `app.useGlobalFilters(new ExceptionFilter())`.
- (EP-1, referenciado) `apps/ledger/src/**/domain/**/exceptions/*.ts` con el
  `code` de la tabla. EP-2 aporta el **contract test** que congela el mapeo.
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/error-codes.ts`:
  enum/const `LedgerErrorCode` como fuente única de los strings RF-14
  (compartido entre excepciones y tests, evita drift).

### Firma
```ts
export const LEDGER_ERROR_CODE = {
  UNBALANCED_TRANSACTION: 'UNBALANCED_TRANSACTION',
  ACCOUNT_CLOSED: 'ACCOUNT_CLOSED',
  CURRENCY_NOT_ALLOWED: 'CURRENCY_NOT_ALLOWED',
  DUPLICATE_EXTERNAL_REF: 'DUPLICATE_EXTERNAL_REF',
  IMMUTABLE_TRANSACTION: 'IMMUTABLE_TRANSACTION',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  NAME_COLLISION: 'NAME_COLLISION',
  SYSTEM_ACCOUNT_PROTECTED: 'SYSTEM_ACCOUNT_PROTECTED',
} as const;

export class UnbalancedTransactionException extends DomainUnprocessableException {
  readonly code = LEDGER_ERROR_CODE.UNBALANCED_TRANSACTION;
}
export class ConcurrencyConflictException extends DomainConflictException {
  readonly code = LEDGER_ERROR_CODE.CONCURRENCY_CONFLICT;
}
```

### Plan TDD
- Contract test tabular: por cada `code`, lanzar la excepción a través del filter
  y afirmar `{ statusCode, code }` esperados
  (espejo de `libs/shared/src/filters/exception.filter.spec.ts`).
  - `UnbalancedTransactionException maps to 422 with code UNBALANCED_TRANSACTION`.
  - `ConcurrencyConflictException maps to 409 with code CONCURRENCY_CONFLICT`.
  - ... (una aserción por fila de la tabla).
- `unknown errors map to 500 without leaking a domain code`.
- e2e (ya cubiertos en 2.4/2.5) validan el código real por endpoint.

### Criterios de aceptación
- Todo fallo de dominio/puerto responde con `code` estable de la tabla y su
  status; el cuerpo sigue `ErrorResponseBody`.
- El mapeo está congelado por contract tests; agregar un code nuevo obliga a
  actualizar la tabla y su test.

### Dependencias: jerarquía de excepciones de EP-1 (agregados + puerto EventStore).
### Estimación: **M**

---

## EP-2.7 — Read-your-writes (RNF-9) + idempotencia por `external_ref` (RF-11)

### Objetivo
(a) Permitir a un cliente leer sus propias escrituras (RNF-9) y (b) exponer la
idempotencia por `external_ref` en el borde HTTP (RF-11/INV-10) sin duplicar la
maquinaria: el ledger no usa el `IdempotencyInterceptor` de `finances`.

### (a) Read-your-writes (RNF-9)
Dos mecanismos combinados, alineados con la decisión de proyección híbrida
sesgada a síncrono (§8.1):

1. **Proyección síncrona de las vistas críticas**: `transaction_list`,
   `proj_postings`, `account_balances`, `account_tree` se actualizan en la
   **misma transacción del command** (EP-1.9/1.10). En un único PostgreSQL esto
   es ACID conjunto: tras un `2xx`, el `GET` inmediato ya ve el dato. Es el
   camino por defecto y hace RNF-9 trivial para el frontend.
2. **Posición de stream explícita** para clientes que consumen proyecciones
   eventualmente consistentes (futuras, EP-3/EP-4): toda escritura devuelve
   `streamPosition` en el body (`CommandAcceptedDto`) **y** en el header de
   respuesta `X-Ledger-Stream-Position`. Las queries aceptan un parámetro
   opcional `min_position` (o header `X-Ledger-Min-Position`); el query handler
   puede esperar/verificar que la proyección alcanzó esa posición (checkpoint)
   antes de responder, o devolver `stale=true`. En EP-2 (solo vistas síncronas)
   se **expone** la posición pero la espera es no-op; el gancho queda listo para
   EP-3+.

Firma:
```ts
@Post()
async record(/* ... */): Promise<CommandAcceptedDto> {
  const result = await this.commandBus.dispatch<CommandResult>(command);
  this.response.setHeader('X-Ledger-Stream-Position', String(result.streamPosition));
  return CommandAcceptedDto.from(result);
}
```

### (b) Idempotencia por `external_ref` (RF-11 / INV-10)
- **Fuente del valor**: header `X-External-Ref` (preferido para clientes
  automatizados) con *fallback* a `external_ref` en el body. Un param decorator
  `@ExternalRef()` lo extrae de forma uniforme.
- **Dónde vive la idempotencia**: en el puerto `EventStore.append` (EP-1.3),
  respaldada por el índice único `(user_id, external_ref)` del event store
  (§6.1). El controller **solo transporta** el `external_ref` al command.
- **Obligatoriedad**: opcional para el frontend, **obligatorio para clientes
  automatizados** (RF-11). En dev se documenta como opcional; la exigencia por
  `client_id` se difiere (no hay registro de clientes, §2.10). Un
  `@ExternalRef({ required: true })` puede fijarse por endpoint si se decide.
- **Comportamiento observable**:
  - Primer envío → se emiten eventos, `2xx` con `streamPosition` nuevo.
  - Reenvío idéntico (mismo `external_ref`) → EP-1 detecta el replay y retorna el
    **resultado original**; el API responde el **mismo** `CommandAcceptedDto`
    (misma `streamPosition`), `2xx`. No se emiten eventos nuevos (INV-10/RNF-4).
  - Mismo `external_ref`, command conflictivo → `409 DUPLICATE_EXTERNAL_REF`
    (EP-2.6).

Firma del decorador:
```ts
export const ExternalRef = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Nullable<string> => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-external-ref'] ?? request.body?.external_ref ?? null;
  },
);
```

### Archivos a crear
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/external-ref.decorator.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/stream-position.interceptor.ts`
  (opcional: setea `X-Ledger-Stream-Position` de forma transversal a partir del
  `CommandResult`, para no repetirlo en cada método).

### Plan TDD
- `@ExternalRef() reads X-External-Ref header`.
- `@ExternalRef() falls back to body.external_ref`.
- `@ExternalRef() returns null when neither is present`.
- e2e `POST /transactions twice with the same external_ref emits events once and
  returns the same stream position` (idempotencia observable).
- e2e `POST /transactions then immediate GET returns the new transaction`
  (read-your-writes vía proyección síncrona).
- e2e `every write response carries X-Ledger-Stream-Position`.
- e2e `reusing an external_ref for a conflicting command responds 409 DUPLICATE_EXTERNAL_REF`.

### Criterios de aceptación
- Toda escritura expone `streamPosition` (body + header).
- Reintentos con el mismo `external_ref` son idempotentes y observables como tal.
- El `GET` inmediato tras un `2xx` ve la escritura (vistas críticas síncronas).

### Dependencias: EP-1.3/1.5 (idempotencia en EventStore), EP-1.9/1.10 (proyección
síncrona), EP-2.2, EP-2.6.
### Estimación: **M**

---

## Apéndice A — Esqueleto OpenAPI (paths principales de EP-2)

```yaml
openapi: 3.1.0
info:
  title: Ledger API
  version: 1.0.0
  description: Double-entry personal-finance ledger — CQRS + event sourcing.
servers:
  - url: /api/v1
security:
  - gatewayContext: []      # X-User-Id + X-Client-Id (default dev)
  # - bearerAuth: []        # JWT (alternativa, pregunta abierta #5)
components:
  securitySchemes:
    gatewayContext:
      type: apiKey
      in: header
      name: X-User-Id        # + X-Client-Id, inyectados por el gateway de confianza
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  parameters:
    ExternalRef:
      name: X-External-Ref
      in: header
      required: false
      schema: { type: string }
      description: Idempotency key per user (RF-11 / INV-10).
  schemas:
    CommandAccepted:
      type: object
      required: [id, sequence, streamPosition]
      properties:
        id: { type: string, format: uuid }
        sequence: { type: integer }
        streamPosition: { type: integer, description: Read-your-writes cursor (RNF-9). }
    Error:
      type: object
      required: [statusCode, error, message, timestamp]
      properties:
        statusCode: { type: integer }
        error: { type: string }
        message: { type: string }
        code:
          type: string
          enum: [UNBALANCED_TRANSACTION, ACCOUNT_CLOSED, CURRENCY_NOT_ALLOWED,
                 DUPLICATE_EXTERNAL_REF, IMMUTABLE_TRANSACTION, CONCURRENCY_CONFLICT,
                 NAME_COLLISION, SYSTEM_ACCOUNT_PROTECTED]
        path: { type: string }
        timestamp: { type: string, format: date-time }
paths:
  /ledger/initialize:
    post: { summary: InitializeLedger, responses: { '201': { $ref: '#/components/schemas/CommandAccepted' } } }
  /ledger/settings:
    get: { summary: Read ledger settings }
  /accounts:
    post: { summary: OpenAccount }
    get:  { summary: List account tree, parameters: [ { name: view, in: query } ] }
  /accounts/{id}:
    get: { summary: Get account }
  /accounts/{id}/balance:
    get: { summary: Account balances (account_balances projection) }
  /accounts/{id}/rename:
    post: { summary: RenameAccount }
  /accounts/{id}/close:
    post: { summary: CloseAccount }
  /transactions:
    post: { summary: RecordTransaction }
    get:  { summary: List/filter transactions (payee, status, period, ...) }
  /transactions/{id}:
    get: { summary: Get transaction }
  /transactions/{id}/amend:    { post: { summary: AmendPendingTransaction } }
  /transactions/{id}/annotate: { post: { summary: AnnotateTransaction } }
  /transactions/{id}/confirm:  { post: { summary: ConfirmTransaction } }
  /transactions/{id}/void:     { post: { summary: VoidPendingTransaction } }
  /transactions/{id}/reverse:  { post: { summary: ReverseConfirmedTransaction } }
  # Diferidos (EP-3/EP-4), listados en §7 para contexto, fuera de EP-2:
  # /transfers/candidates, /transfers/merge, /balance-assertions*,
  # /currencies, /prices, /budgets, /goals, /reports/*
```

Recursos de §7 **fuera de EP-2** (para trazabilidad): `/transfers/*` y
`/balance-assertions/*` → EP-3; `/currencies`, `/prices`, `/budgets`, `/goals`,
`/reports/*` y las mutaciones de `/ledger/settings` → EP-4.

---

## Apéndice B — Decisión de versionado del API (RNF-8)

- **Mecanismo**: versionado por URI (`/api/v1`) con `VersioningType.URI` de
  NestJS + prefijo global `api`. `defaultVersion: '1'`.
- **Política de evolución**: cambios **aditivos** (nuevos endpoints, nuevos
  campos opcionales, nuevos `code` de error) no rompen y no suben major. Un
  cambio **incompatible** (renombrar/quitar campo, cambiar semántica, cambiar un
  status) abre `/api/v2`, conviviendo con `v1` durante la transición
  (`@Version('2')` selectivo por controller/método).
- **Contrato publicado**: el OpenAPI se genera desde el código (decoradores
  `@nestjs/swagger`) y se sirve en `/api/v1/docs` fuera de producción; es el
  insumo formal para el frontend y el sistema de correos (pregunta abierta #2).
- **Códigos de error como parte del contrato**: el enum de `code` (RF-14) es
  contrato estable; ampliarlo es aditivo, cambiar el status de uno existente es
  breaking (nueva versión).

---

## Apéndice C — Decisiones abiertas para el usuario

1. **Formato del contexto autenticado (pregunta abierta #5 de la spec).**
   ¿Headers firmados por el gateway (`X-User-Id`/`X-Client-Id`), JWT verificado
   por el ledger (reusando `JwtStrategy` de `libs/shared/src/auth`), o mTLS
   interno? EP-2 lo abstrae tras `LedgerContextResolver`, con
   `GatewayHeaderContextResolver` como default de desarrollo; **la elección
   definitiva se define con el servicio de identidad**. Recomendación:
   headers firmados en malla interna de confianza; JWT si el ledger se expone a
   clientes semi-confiables.

2. **¿`external_ref` obligatorio para todos o solo automatizados (RF-11)?**
   Sin registro de clientes (§2.10), no podemos distinguir "automatizado" por
   `client_id`. Opciones: (a) opcional global en dev, (b) obligatorio por
   endpoint vía `@ExternalRef({ required: true })`, (c) obligatorio cuando
   `client_id` esté en una allowlist. Recomendación: (a) ahora, (b) al integrar
   el sistema de correos.

3. **Filtros de `GET /transactions`: ¿criteria genérico de `shared` o DTO
   tipado?** Trade-off entre reuso (`CriteriaQueryDto`) y claridad del contrato
   OpenAPI (DTO tipado con `account`/`period`/`payee`/...). Recomendación: DTO
   tipado.

4. **Estilo de las transiciones de estado: sub-recurso POST de acción
   (`/confirm`, `/void`, ...) vs. `PATCH` con `status`.** Este plan asume
   sub-recursos de acción (un command por verbo). Confirmar preferencia.

5. **`rename`/`close` de cuentas: `POST` de acción vs. `PATCH`/`DELETE`.** El
   plan usa `POST` de acción por ser transiciones event-sourced, no CRUD.
   Confirmar.

6. **Body de `X-Ledger-Min-Position` / espera activa en queries.** En EP-2 las
   vistas críticas son síncronas y la espera es no-op; ¿se implementa ya el
   gancho de espera por checkpoint para las proyecciones asíncronas de EP-3/EP-4,
   o se difiere a esas épicas? Recomendación: exponer el header ahora, implementar
   la espera en EP-3.

---

## Apéndice D — Resumen de estimaciones y dependencias

| Subtarea | Estimación | Depende de |
|---|---|---|
| EP-2.1 OpenAPI + versionado | S | EP-0 |
| EP-2.2 Adaptador HTTP (patrón buses) | M | EP-1.8, EP-1.11 |
| EP-2.3 Contexto autenticado (RF-26) | M | EP-2.2 |
| EP-2.4 Endpoints de cuentas | L | EP-1.6/1.8/1.10/1.11, EP-2.2/2.3 |
| EP-2.5 Endpoints de transacciones | L | EP-1.7/1.8/1.10/1.11, EP-2.2/2.3/2.6/2.7 |
| EP-2.6 Códigos de error (RF-14) | M | Excepciones de EP-1 (agregados + EventStore) |
| EP-2.7 Read-your-writes + idempotencia | M | EP-1.3/1.5/1.9/1.10, EP-2.2/2.6 |

Ruta crítica: EP-2.1 → EP-2.2 → EP-2.3 → (EP-2.6, EP-2.7 en paralelo) → EP-2.4,
EP-2.5. EP-2.6 y EP-2.7 son transversales y deben estar listos antes de cerrar
los e2e de 2.4/2.5.

### Riesgos
- **Pregunta abierta #5 sin cerrar** puede cambiar el `LedgerContextResolver`;
  mitigado por el puerto (cambio de un provider, no de controllers).
- **Códigos RF-14 originados en el puerto `EventStore`** (`CONCURRENCY_CONFLICT`,
  `DUPLICATE_EXTERNAL_REF`): requieren que EP-1 tipe esas excepciones dentro de la
  jerarquía `DomainException`; coordinar con EP-1 para no acabar con `catch`
  especiales en el filter.
- **Read-your-writes**: depende de que EP-1.9/1.10 entreguen las proyecciones
  críticas en modo síncrono; si alguna cae a asíncrona, hay que activar la espera
  por `min_position` antes de lo previsto.
- **Deriva de contrato**: el OpenAPI se genera del código; disciplina de
  decoradores `@Api*` para que el documento publicado (insumo del frontend y
  correos) no divergir de la implementación.
```
