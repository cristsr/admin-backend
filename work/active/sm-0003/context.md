# context: sm-0003

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** responsable de la integridad de los datos financieros
**Quiero** que el dominio garantice consistencia ante fallos, duplicados y operaciones concurrentes
**Para** que ningún movimiento se pierda, se duplique o deje el saldo en un estado imposible

Cubre 5 ACs: (1) validación de saldo en transferencias configurable por cuenta,
(2) patrón Outbox transaccional para eventos de dominio, (3) idempotencia por
`Idempotency-Key` en escrituras de usuario, (4) reglas de auto-categorización,
(5) política de archivado de cuentas con movimientos.

## Microservicios afectados

- `apps/finances` (única app; monolito que ya absorbió `users` y `exchanges`)

Módulos tocados dentro de la app: `account`, `movement`, `transfer`, `budget`
(eventos de dominio), `category`, `webhook`, más artefactos **nuevos** para
outbox e idempotencia.

---

## apps/finances

Raíz de código: `D:/Cristian/Nest/admin-back/apps/finances/src/`

### AC-1 — Validación de saldo en transferencias (módulo account + transfer)

**Entidad de dominio account**
`D:/Cristian/Nest/admin-back/apps/finances/src/account/domain/account/account.entity.ts`
Campos: `id: number`, `createdAt/updatedAt/deletedAt: Date`, `name: string`,
`initialBalance: number`, `currency: string`, `user: number`.
⚠️ **No existe** ningún flag `allowNegativeBalance` ni `accountType` → la política
de saldo negativo por cuenta que pide AC-1 **requiere agregar una columna/campo nuevo**.

**Cálculo de saldo vivo (sm-0001 AC-3) — YA IMPLEMENTADO, reutilizable**
`D:/Cristian/Nest/admin-back/apps/finances/src/account/application/usecases/get-account-balance.usecase.ts`
`constructor(private readonly accountRepository: AccountRepository)`
`execute(id: number, user: number): Promise<AccountBalanceOutputDto>` — calcula
`initialBalance + movementBalance`. Endpoint `GET /accounts/:id/balance`.
AC-1 debe **consumir este cálculo** (o `accountRepository.movementBalance(...)`), no reimplementarlo.

**Puerto/repositorio account**
`D:/Cristian/Nest/admin-back/apps/finances/src/account/domain/account/account.repository.ts` (`abstract class AccountRepository`)
Métodos: `findByIdAndUser(id, user): Promise<Nullable<Account>>`,
`findAllByUser(user): Promise<Account[]>`, `save(account): Promise<Account>`,
`softRemove(id, user): Promise<boolean>`, `hasMovements(id): Promise<boolean>`,
`movementBalance(accountId, user): Promise<number>`,
`movementBalancesByUser(user): Promise<Record<number, number>>`.
Impl TypeORM: `.../infrastructure/adapters/persistence/typeorm/account/typeorm-account.repository.ts`
(usa `dataSource.query` con SQL crudo en `hasMovements`/`movementBalance*` para
evitar el ciclo de módulo con `movement`).

**Usecase de creación de transferencia (donde va la validación)**
`D:/Cristian/Nest/admin-back/apps/finances/src/transfer/application/usecases/create-transfer.usecase.ts`
`constructor(accountRepository: AccountRepository, movementRepository: MovementRepository, exchangeRateProvider: ExchangeRateProvider)`
`execute(input: TransferInputDto, user: number): Promise<TransferOutputDto>`.
Genera `transferGroup = randomUUID()`, guarda ambas patas (`TRANSFER_OUT`/`TRANSFER_IN`)
con `movementRepository.saveAll([...])` en transacción. Ya soporta cross-currency.
La validación de saldo insuficiente de AC-1 se inserta acá, antes del `saveAll`.

### AC-2 — Patrón Outbox transaccional (módulo budget / eventos de dominio)

**Emisión actual de `movement.saved` (frágil, en memoria)**
`D:/Cristian/Nest/admin-back/apps/finances/src/movement/application/usecases/save-movement.usecase.ts`
Emite `this.eventEmitter.emit(MovementSaved, {...} as MovementSavedPayload)` con
`EventEmitter2` (`@nestjs/event-emitter`) **después** del `movementRepository.save` —
fuera de la transacción DB. Constante `MovementSaved` en `movement.constants.ts`.

**Cadena de handlers existente**
- `.../budget/infrastructure/adapters/events/movement-saved.event-handler.ts` —
  `@OnEvent(MovementSaved) handle(payload: MovementSavedPayload)`, calcula `percentage`,
  deduplica por `notifiedThreshold`, emite `BudgetThresholdExceeded`.
- `.../budget/infrastructure/adapters/events/budget-threshold-exceeded.event-handler.ts` —
  `@OnEvent(BudgetThresholdExceeded) handle(payload)`, delega a `publisher.publish(payload)`.

**Puerto de mensajería (abstracción a reutilizar como modelo)**
`D:/Cristian/Nest/admin-back/apps/finances/src/budget/domain/budget/budget-notification.publisher.ts`
`abstract class BudgetNotificationPublisher { abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>; }`
Impl real: `.../budget/infrastructure/adapters/messaging/pgmq-budget-notification.publisher.ts`
`PgmqBudgetNotificationPublisher` — `constructor(dataSource: DataSource, config: ConfigService)`,
`publish(payload)` hace `dataSource.query('SELECT pgmq.send($1,$2)', [queue, JSON.stringify(payload)])`
sobre la extensión Postgres **pgmq**; si falla solo loguea. **Este es el componente de
mensajería a reutilizar** (Q5): el outbox debe entregar a PGMQ detrás de un puerto
abstract-class intercambiable (RabbitMQ a futuro).

**Transacciones TypeORM (patrón existente)**
`this.repository.manager.transaction(async (manager) => {...})` en
`.../movement/infrastructure/adapters/persistence/typeorm/movement/typeorm-movement.repository.ts`
método `saveAll`. Es el patrón a usar para persistir el evento outbox en la misma
transacción que el movimiento.

**Scheduler (patrón para el relay/cron interno de AC-2)**
`D:/Cristian/Nest/admin-back/apps/finances/src/budget/infrastructure/adapters/schedulers/budget.scheduler.ts`
`@nestjs/schedule` + `@Cron(CronExpression...)`. `ScheduleModule.forRoot()` ya activo
en `app.module.ts`. El relay del outbox sigue este patrón.

⚠️ **No existe tabla ni patrón `outbox`** (búsqueda global sin resultados) → hay que
crear entidad de dominio + entidad TypeORM + migración + puerto + relay + suscriptor.

### AC-3 — Idempotencia por Idempotency-Key (módulos movement + transfer)

**Controladores destino (hoy sin header)**
- `.../movement/infrastructure/adapters/http/movement.controller.ts` — `POST /movements` (`save`),
  `PATCH /movements/:id`, `GET`, `DELETE`. Usa `@CurrentUser() user: AuthenticatedUser`.
  Sin lectura de `Idempotency-Key`.
- `.../transfer/infrastructure/adapters/http/transfer.controller.ts` — `POST /transfers` (`create`),
  `POST /transfers/:transferGroup/reversal`. Sin lectura de `Idempotency-Key`.

**Único patrón de idempotencia existente (referencia, no reutilizable directo)**
Clave de negocio única: `externalReference` en webhook (`findByExternalReference` →
`{duplicate: true}`) y `transferGroup = "reversal:{original}"` en reversas. Migración
`1784073600009-AddMovementExternalReference.ts` creó el índice único parcial.
⚠️ **No hay** header `Idempotency-Key`, guard, ni tabla genérica → artefacto nuevo
(entidad + tabla + guard/interceptor + validación de hash de body; retención 24h + job de purga).

### AC-4 — Reglas de auto-categorización (módulos category + webhook + movement)

**Taxonomía de categorías (global, 2 niveles)**
- `.../category/domain/category/category.entity.ts` — `id`, timestamps, `name`, `icon`,
  `color`, `subcategories?: Subcategory[]`.
- `.../category/domain/subcategory/subcategory.entity.ts` — `id`, timestamps, `name`, `categoryId`.
- Sin `user` (taxonomía global), **sin flag de sistema/default** → la categoría default
  "Sin categorizar" de AC-4 no existe hoy.
- Repositorio: `.../category/domain/category/category.repository.ts` (`abstract class CategoryRepository`):
  `findById`, `findByName`, `findAll(query?)`, `save`, `saveMany`, `remove`. Análogo `SubcategoryRepository`.

**Entidad movement (campos relevantes al match)**
`.../movement/domain/movement/movement.entity.ts` — incluye `merchant?: string`,
`description: string`, `categoryId: number`, `subcategoryId?: number`, `source: MovementSource`
(distingue WEBHOOK vs manual). Tipos en `movement.types.ts`.

**Categorización actual en webhook (sin reglas)**
`.../webhook/application/usecases/receive-webhook-transaction.usecase.ts` — recibe
`input.category`/`input.subcategory` como strings del emisor (Rust) y resuelve por
`categoryRepository.findByName(...)`; si no existe lanza 404. Idempotente por `externalReference`.
⚠️ **No existe ningún motor de reglas** (`rule`/`categoriz*` sin resultados) → entidad
`CategorizationRule` (patrón substring case-insensitive + prioridad), repositorio,
usecase de match, y punto de enganche en webhook + save-movement manual: artefactos nuevos.

### AC-5 — Política de archivado de cuentas (módulo account)

**Remove actual (hoy BLOQUEA, hay que cambiarlo)**
`.../account/application/usecases/remove-account.usecase.ts` — hoy lanza
`AccountHasMovementsException` (409) si `accountRepository.hasMovements(id)` es true;
usa `softDelete` (columna `deletedAt` de `BaseEntity`).
AC-5 pide cambiar a **soft-delete en cascada**: archivar la cuenta + soft-delete de
sus movimientos + soft-delete del par completo de transferencias (`transferGroup`),
excluyendo lo soft-deleted de todos los cálculos.

**Reversa de transferencia (referencia de manejo de transferGroup)**
`.../transfer/application/usecases/reverse-transfer.usecase.ts` — `constructor(movementRepository)`,
`execute(transferGroup, user)`. Muestra cómo operar sobre ambas patas de un `transferGroup`.

### Infraestructura transversal

**app.module.ts** `D:/Cristian/Nest/admin-back/apps/finances/src/app.module.ts`
Importa: `ConfigModule`, `CacheModule`, `ScheduleModule.forRoot()`,
`EventEmitterModule.forRoot({})`, `DatabaseModule`, `AuthModule.forRootAsync(...)`,
`AccountModule`, `CategoryModule`, `MovementModule`, `SummaryModule`, `BudgetModule`,
`ScheduledModule`, `TransferModule`, `UserModule`, `WebhookModule`.
(`ExchangeModule` no se importa directo; lo consume `TransferModule`.)

**Migraciones** `.../database/migrations/` — 19 archivos (`...001-CreateAccountsTable`
… `...016-DropActiveExceptBudgets`, `...017-AddBudgetNotifiedThreshold`,
`...018-CreateUsersTable`, `...019-CreateExchangesTable`). Timestamps correlativos
`1784073600001..019`. Enum-like como varchar (nunca enum de Postgres). Las nuevas
migraciones de sm-0003 continúan la numeración.

**data-source.ts** `.../database/data-source.ts` — entidades: `TypeOrmAccountEntity`,
`TypeOrmCategoryEntity`, `TypeOrmSubcategoryEntity`, `TypeOrmMovementEntity`,
`TypeOrmBudgetEntity`, `TypeOrmScheduledEntity`, `UserEntity`, `ExchangeEntity`;
`synchronize: false`. Las entidades TypeORM nuevas (outbox, idempotency-key,
categorization-rule) deben registrarse aquí.

**@shared** `D:/Cristian/Nest/admin-back/libs/shared/src`
- Decoradores: `CurrentUser` (`@CurrentUser()`), `Public` (`@Public()`).
- Excepciones: `BaseException` → `DomainException` (abstract, `status`/`format()`) →
  `DomainNotFoundException` (404), `DomainConflictException` (409);
  `InvalidConfigurationException`. Filtro global `ExceptionFilter`.
- Base: `BaseEntity` (id/createdAt/updatedAt/deletedAt con `@TransformDate`).
- Tipos: `Nullable<T>`, `PropertiesOnly<T>`.
- Para AC-3 (422) y políticas nuevas, extender esta jerarquía (no lanzar `Error` crudo).

**@core** `libs/core/src` — solo DTOs anémicos; nada relevante para sm-0003.

### Documentación disponible

`RESUMEN_EJECUTIVO.md` (índice de módulos/endpoints/migraciones) y
`LLUVIA_DE_IDEAS.md` (backlog, Grupo C). Ambos parcialmente desactualizados (ver Gaps).
No hay `docs/services/<micro>/` por componente.

---

## Gaps detectados

**Artefactos nuevos que la historia debe crear (no existen hoy):**
1. **AC-1:** campo/columna de política de saldo negativo por cuenta (`allowNegativeBalance`
   o `accountType`) en la entidad account — no existe.
2. **AC-2:** tabla/entidad **outbox**, puerto, relay (cron interno) y suscriptor — no existe
   nada de outbox. Debe entregar a PGMQ detrás de un puerto intercambiable.
3. **AC-3:** header `Idempotency-Key`, tabla de idempotencia, guard/interceptor y validación
   de hash de body, retención 24h + job de purga — no existe idempotencia genérica.
4. **AC-4:** entidad `CategorizationRule` + motor de match (substring case-insensitive +
   prioridad) + categoría default "Sin categorizar" — no existe motor de reglas ni flag default.
5. **AC-5:** cambiar `remove-account.usecase` de bloquear a soft-delete en cascada
   (cuenta + movimientos + par de transferencias) excluyendo soft-deleted de cálculos.

**Documentación desactualizada (informativo, no bloquea):**
- `RESUMEN_EJECUTIVO.md` §9.7 y `LLUVIA_DE_IDEAS.md` idea #1 dicen que
  `BudgetThresholdExceeded` "no tiene canal de entrega / solo log" — **falso**, ya existe
  `PgmqBudgetNotificationPublisher`. El gap real vigente es solo el outbox transaccional (idea #14).
- `create-transfer` cross-currency, `update-movement` (`PATCH /movements/:id`),
  `reverse-transfer` y `reverse-webhook-transaction` **ya existen** pero figuran como
  pendientes/limitaciones en la doc.
- Migraciones 17-19 no documentadas en `RESUMEN_EJECUTIVO.md §5`.
- `RESUMEN_EJECUTIVO.md §1` dice "cada microservicio conserva su propia base de datos" —
  desactualizado; el repo está en pleno merge de `users`/`exchanges` al monolito `finances`
  (coincide con `CLAUDE.md`, no con el resumen).

**Reutilizables clave (ya implementados, consumir no reimplementar):**
- `GetAccountBalanceUsecase` / `AccountRepository.movementBalance` → saldo vivo para AC-1.
- `PgmqBudgetNotificationPublisher` + patrón puerto abstract-class → mensajería para AC-2.
- `manager.transaction(...)` en `typeorm-movement.repository.saveAll` → transacción para outbox.
- `@Cron` en `budget.scheduler.ts` → patrón del relay de AC-2.
- Jerarquía de excepciones `@shared` (`DomainConflictException` 409, base para 422 de AC-3).
