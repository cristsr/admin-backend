# sm-0003: Robustez del dominio y consistencia — Plan de Implementación

> **Para Claude:** USA el skill /build para implementar este plan tarea por tarea.

**Historia:** `work/active/sm-0003/`
**Microservicio(s):** `apps/finances`
**Objetivo:** Endurecer el dominio financiero con validación de saldo en transferencias,
outbox transaccional para eventos de dominio, idempotencia en escrituras de usuario,
auto-categorización por reglas y archivado de cuentas en cascada.
**Arquitectura:** Hexagonal por módulo (`domain`/`application`/`infrastructure/adapters`).
Puertos como `abstract class` (DI por clase), DTOs `*-input`/`*-output`, mappers
dominio↔TypeORM, columnas enum-like como varchar. Se reutiliza el saldo vivo de sm-0001,
el `PgmqBudgetNotificationPublisher` y el patrón `@Cron`. Módulos nuevos: `outbox`,
`idempotency`, `categorization-rule`.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest
**Orden de implementación:** un único microservicio (`finances`). Secuencia por AC:
AC-1 → AC-2 → AC-3 → AC-4 → AC-5. Los ACs son independientes entre sí; se pueden
ejecutar como sub-entregables separados, pero comparten el registro en `app.module.ts`
y `data-source.ts`.

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 (validación de saldo en transferencias) | Tarea 1, Tarea 2, Tarea 3 |
| AC-2 (outbox transaccional) | Tarea 4, Tarea 5, Tarea 6, Tarea 7, Tarea 8 |
| AC-3 (idempotencia) | Tarea 9, Tarea 10, Tarea 11, Tarea 12, Tarea 13 |
| AC-4 (auto-categorización) | Tarea 14, Tarea 15, Tarea 16, Tarea 17, Tarea 18, Tarea 19 |
| AC-5 (archivado en cascada) | Tarea 20, Tarea 21 |
| Suite completa | Tarea 22 |

> Nota de test runner: los comandos usan `npx jest <path> --no-coverage` desde
> `apps/finances`. Si el proyecto solo corre vía Nx, equivale a
> `npx nx test finances --testFile=<path>`. `/build` debe usar el que funcione en el repo.

---

### Tarea 0: Preparar rama de trabajo [X]

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: feat/SM-0003-domain-robustness)"

**Step 1: Verificar estado (read-only)**

```bash
git -C D:/Cristian/Nest/admin-back branch --show-current
git -C D:/Cristian/Nest/admin-back status --porcelain
```
Esperado: el repo está en desarrollo activo (rama `feat/core`). No hay `develop`; la
rama base del proyecto es `master`. Si el working tree tiene cambios sin relación con
sm-0003, avisar antes de crear la rama.

**Step 2: Crear rama de trabajo**

```bash
git -C D:/Cristian/Nest/admin-back checkout -b <nombre-de-rama-dado-por-usuario>
```
Esperado: rama nueva creada y activa.

---

## AC-1 — Validación de saldo en transferencias (configurable por cuenta)

### Tarea 1: Campo `allowNegativeBalance` en account (entidad + migración + DTO + mapper) [X]

**Archivos:**
- Modificar: `apps/finances/src/account/domain/account/account.entity.ts`
- Modificar: `apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.entity.ts`
- Modificar: mapper dominio↔TypeORM de account (`.../typeorm/account/*.mapper.ts`)
- Modificar: `apps/finances/src/account/application/dto/account-input.dto.ts`
- Modificar: `apps/finances/src/account/application/dto/account-output.dto.ts`
- Crear: `apps/finances/src/database/migrations/1784073600020-AddAccountAllowNegativeBalance.ts`
- Test: `apps/finances/src/account/application/usecases/save-account.usecase.spec.ts` (extender)

**Step 1: Escribir el test que falla**

Agregar al spec de `SaveAccountUsecase` un caso que persista `allowNegativeBalance`:

```typescript
it('persists allowNegativeBalance when creating an account', async () => {
  const input = { name: 'Credit Card', currency: 'USD', allowNegativeBalance: true };
  accountRepository.save.mockImplementation(async (a) => ({ ...a, id: 1 }));

  const result = await usecase.execute(input as AccountInputDto, 42);

  expect(accountRepository.save).toHaveBeenCalledWith(
    expect.objectContaining({ allowNegativeBalance: true }),
  );
  expect(result.allowNegativeBalance).toBe(true);
});

it('defaults allowNegativeBalance to false when omitted', async () => {
  const input = { name: 'Debit', currency: 'USD' };
  accountRepository.save.mockImplementation(async (a) => ({ ...a, id: 2 }));

  const result = await usecase.execute(input as AccountInputDto, 42);

  expect(result.allowNegativeBalance).toBe(false);
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
cd apps/finances
npx jest src/account/application/usecases/save-account.usecase.spec.ts --no-coverage
cd ../..
```
Esperado: FAIL — `allowNegativeBalance` no existe en el tipo / result undefined.

**Step 3: Implementar**

Dominio `account.entity.ts` — agregar propiedad readonly y en `create()`/`update()` con default:

```typescript
readonly allowNegativeBalance: boolean;
// en create(): allowNegativeBalance: props.allowNegativeBalance ?? false,
```

TypeORM `typeorm-account.entity.ts`:

```typescript
@Column({ name: 'allow_negative_balance', type: 'boolean', default: false })
allowNegativeBalance: boolean;
```

Mapper: mapear `allowNegativeBalance` en ambos sentidos.

`account-input.dto.ts`:

```typescript
@ApiPropertyOptional({ description: 'If true, the account may hold a negative balance.' })
@IsOptional()
@IsBoolean()
allowNegativeBalance?: boolean;
```

`account-output.dto.ts`: agregar `allowNegativeBalance: boolean;` y mapearlo en el
constructor/factory de salida.

Migración `1784073600020-AddAccountAllowNegativeBalance.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-1 (sm-0003) — per-account policy for negative balance. Debit accounts keep
 * false; credit-card-like accounts set true so transfers that would leave them
 * negative are not rejected.
 */
export class AddAccountAllowNegativeBalance1784073600020
  implements MigrationInterface
{
  name = 'AddAccountAllowNegativeBalance1784073600020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "allow_negative_balance" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "allow_negative_balance"`,
    );
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
cd apps/finances && npx jest src/account/application/usecases/save-account.usecase.spec.ts --no-coverage && cd ../..
```
Esperado: PASS

---

### Tarea 2: `InsufficientBalanceException` (422) [X]

**Archivos:**
- Crear: `apps/finances/src/transfer/domain/transfer/transfer.exception.ts` (o extender el existente)
- Test: cubierto por Tarea 3

**Step 1–2: (sin test propio — excepción pura, se verifica en Tarea 3)**

**Step 3: Implementar**

Revisar la jerarquía de `@shared`: si no existe una base 422, crear la excepción
extendiendo `DomainException` con `status = 422`.

```typescript
import { DomainException } from '@shared';

/**
 * Raised when a transfer would leave the source account negative and that
 * account does not allow a negative balance (AC-1). 422: the request is valid
 * but violates a business rule.
 */
export class InsufficientBalanceException extends DomainException {
  readonly status = 422;

  constructor(accountId: number) {
    super(`Account ${accountId} has insufficient balance for this transfer`);
  }
}
```

> Si `DomainException` no permite fijar `status = 422` por propiedad, seguir el patrón
> de `DomainConflictException` (que fija 409) y crear una base `DomainUnprocessableException`
> (422) en `@shared`, reutilizable por AC-3.

---

### Tarea 3: Validación de saldo en `CreateTransferUsecase` [X]

**Archivos:**
- Modificar: `apps/finances/src/transfer/application/usecases/create-transfer.usecase.ts`
- Test: `apps/finances/src/transfer/application/usecases/create-transfer.usecase.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
describe('CreateTransferUsecase — balance validation (AC-1)', () => {
  it('rejects when source account has insufficient balance and disallows negative', async () => {
    accountRepository.findByIdAndUser.mockResolvedValueOnce(
      account({ id: 1, initialBalance: 100, allowNegativeBalance: false }),
    );
    accountRepository.findByIdAndUser.mockResolvedValueOnce(account({ id: 2 }));
    accountRepository.movementBalance.mockResolvedValue(0); // live balance = 100

    await expect(
      usecase.execute({ sourceAccountId: 1, targetAccountId: 2, amount: 150, date: new Date() }, 42),
    ).rejects.toBeInstanceOf(InsufficientBalanceException);
    expect(movementRepository.saveAll).not.toHaveBeenCalled();
  });

  it('allows the transfer when the source account permits negative balance', async () => {
    accountRepository.findByIdAndUser.mockResolvedValueOnce(
      account({ id: 1, initialBalance: 0, allowNegativeBalance: true }),
    );
    accountRepository.findByIdAndUser.mockResolvedValueOnce(account({ id: 2 }));
    accountRepository.movementBalance.mockResolvedValue(0);

    await usecase.execute({ sourceAccountId: 1, targetAccountId: 2, amount: 150, date: new Date() }, 42);

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });

  it('allows the transfer when live balance covers the amount', async () => {
    accountRepository.findByIdAndUser.mockResolvedValueOnce(
      account({ id: 1, initialBalance: 500, allowNegativeBalance: false }),
    );
    accountRepository.findByIdAndUser.mockResolvedValueOnce(account({ id: 2 }));
    accountRepository.movementBalance.mockResolvedValue(0);

    await usecase.execute({ sourceAccountId: 1, targetAccountId: 2, amount: 150, date: new Date() }, 42);

    expect(movementRepository.saveAll).toHaveBeenCalled();
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
cd apps/finances && npx jest src/transfer/application/usecases/create-transfer.usecase.spec.ts --no-coverage && cd ../..
```
Esperado: FAIL — no se lanza la excepción / `saveAll` se llama igual.

**Step 3: Implementar**

En `create-transfer.usecase.ts`, antes de armar y guardar las patas, calcular el saldo
vivo de la cuenta origen (reutilizando sm-0001: `initialBalance + movementBalance`) y
aplicar la política:

```typescript
const source = await this.accountRepository.findByIdAndUser(input.sourceAccountId, user);
if (!source) throw new AccountNotFoundException(input.sourceAccountId);

const movementBalance = await this.accountRepository.movementBalance(source.id, user);
const liveBalance = source.initialBalance + movementBalance;

// Guard clause — AC-1: reject only when the account forbids going negative.
if (!source.allowNegativeBalance && liveBalance - input.amount < 0) {
  throw new InsufficientBalanceException(source.id);
}
```

Mantener el resto del flujo (cross-currency, `saveAll` de ambas patas) intacto.

**Step 4: Ejecutar y confirmar que pasa**

```bash
cd apps/finances && npx jest src/transfer/application/usecases/create-transfer.usecase.spec.ts --no-coverage && cd ../..
```
Esperado: PASS

> Nota controller: `AccountController` (POST/PATCH) ya usa `AccountInputDto`/`AccountOutputDto`,
> que ganaron el campo en Tarea 1 — no hace falta tarea de controller para AC-1.

---

## AC-2 — Patrón Outbox transaccional para eventos de dominio

### Tarea 4: Entidad `OutboxEvent` + migración + registro en data-source [X]

**Archivos:**
- Crear: `apps/finances/src/outbox/domain/outbox-event/outbox-event.entity.ts`
- Crear: `apps/finances/src/outbox/domain/outbox-event/outbox-event.types.ts` (enum `OutboxStatus`)
- Crear: `apps/finances/src/outbox/infrastructure/adapters/persistence/typeorm/typeorm-outbox-event.entity.ts`
- Crear: mapper dominio↔TypeORM
- Crear: `apps/finances/src/database/migrations/1784073600021-CreateOutboxEventsTable.ts`
- Modificar: `apps/finances/src/database/data-source.ts` (registrar `TypeOrmOutboxEventEntity`)
- Test: (entidad pura — sin test unitario; cubierta por Tareas 6–8)

**Step 3: Implementar** — usar exactamente el modelo de `docs/data-model.md` §OutboxEvent.

`outbox-event.types.ts`:

```typescript
export enum OutboxStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}
```

TypeORM entity y migración: copiar de `docs/data-model.md` (tabla `outbox_events`,
índice `idx_outbox_events_pending`). Timestamp de migración: `1784073600021`.

Registrar la entidad en `data-source.ts` junto a las demás.

---

### Tarea 5: Puerto `OutboxRepository` + adapter TypeORM [X]

**Archivos:**
- Crear: `apps/finances/src/outbox/domain/outbox-event/outbox.repository.ts` (abstract class)
- Crear: `apps/finances/src/outbox/infrastructure/adapters/persistence/typeorm/typeorm-outbox.repository.ts`
- Test: `apps/finances/src/outbox/infrastructure/adapters/persistence/typeorm/typeorm-outbox.repository.spec.ts`

**Step 3: Implementar el puerto**

```typescript
import { EntityManager } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

export abstract class OutboxRepository {
  /** Persist a pending event within the caller's transaction. */
  abstract saveWithinTransaction(
    manager: EntityManager,
    event: Pick<OutboxEvent, 'eventType' | 'payload'>,
  ): Promise<void>;

  /** Claim a batch of deliverable events (PENDING/FAILED, available now). */
  abstract claimPendingBatch(limit: number): Promise<OutboxEvent[]>;

  abstract markDelivered(id: number): Promise<void>;

  /** Increment attempts, store the error and push availableAt by backoff. */
  abstract markFailed(id: number, error: string, backoffSeconds: number): Promise<void>;
}
```

El adapter usa `SELECT ... WHERE status IN ('PENDING','FAILED') AND available_at <= NOW()
ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1` dentro de una transacción para reclamar el batch.

**Test** (con la DB o mockeando `dataSource`): verifica que `claimPendingBatch` no devuelve
filas `DELIVERED` ni con `available_at` futuro, y que `markFailed` incrementa `attempts`.

---

### Tarea 6: Publicador transaccional de eventos de dominio [X]

**Archivos:**
- Crear: `apps/finances/src/outbox/application/services/domain-event-outbox.publisher.ts`
- Test: `apps/finances/src/outbox/application/services/domain-event-outbox.publisher.spec.ts`

**Step 1: Test que falla**

```typescript
it('writes the event to the outbox using the provided transaction manager', async () => {
  const manager = {} as EntityManager;
  await publisher.publish(manager, { eventType: 'movement.saved', payload: { movementId: 1, user: 42 } });
  expect(outboxRepository.saveWithinTransaction).toHaveBeenCalledWith(
    manager,
    expect.objectContaining({ eventType: 'movement.saved' }),
  );
});
```

**Step 3: Implementar** — thin service que delega en `OutboxRepository.saveWithinTransaction`.
Es el único punto por donde los usecases escriben eventos de dominio (AC-2: "todo evento
de dominio pasa por el outbox").

---

### Tarea 7: `SaveMovementUsecase` escribe movimiento + outbox en una transacción [X]

**Archivos:**
- Modificar: `apps/finances/src/movement/application/usecases/save-movement.usecase.ts`
- Modificar: `apps/finances/src/movement/domain/movement/movement.repository.ts` (agregar `saveWithinTransaction` o un `runInTransaction`)
- Modificar: `apps/finances/src/movement/infrastructure/adapters/persistence/typeorm/movement/typeorm-movement.repository.ts`
- Test: `apps/finances/src/movement/application/usecases/save-movement.usecase.spec.ts` (extender)

**Step 1: Test que falla**

```typescript
it('persists the movement and the movement.saved outbox event in the same transaction (AC-2)', async () => {
  await usecase.execute(validMovementInput, 42);

  expect(outboxPublisher.publish).toHaveBeenCalledWith(
    expect.anything(), // the transaction manager
    expect.objectContaining({ eventType: MovementSaved }),
  );
});

it('does not emit movement.saved synchronously via EventEmitter2 anymore', async () => {
  await usecase.execute(validMovementInput, 42);
  expect(eventEmitter.emit).not.toHaveBeenCalledWith(MovementSaved, expect.anything());
});
```

**Step 2: Confirmar FAIL.**

**Step 3: Implementar**

Envolver el guardado en `manager.transaction`: guardar el movimiento con el `manager` y,
en la misma transacción, llamar `outboxPublisher.publish(manager, { eventType: MovementSaved, payload })`.
Quitar el `eventEmitter.emit(MovementSaved, ...)` síncrono — ahora lo entrega el relay (Tarea 8).

```typescript
const saved = await this.movementRepository.runInTransaction(async (manager) => {
  const movement = await this.movementRepository.saveWithManager(manager, toSave);
  await this.outboxPublisher.publish(manager, {
    eventType: MovementSaved,
    payload: { movementId: movement.id, user, amount: movement.amount, categoryId: movement.categoryId },
  });
  return movement;
});
```

**Step 4: Confirmar PASS.**

> Los handlers existentes (`MovementSavedEventHandler`, etc.) NO cambian — siguen
> escuchando `@OnEvent(MovementSaved)`. Lo único que cambia es quién dispara el emit
> (ahora el relay, Tarea 8).

---

### Tarea 8: `OutboxRelayScheduler` (cron interno, re-despacho in-process) [X]

**Archivos:**
- Crear: `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.ts`
- Crear: `apps/finances/src/outbox/outbox.module.ts`
- Modificar: `apps/finances/src/app.module.ts` (importar `OutboxModule`)
- Test: `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.spec.ts`

**Step 1: Test que falla**

```typescript
describe('OutboxRelayScheduler (AC-2)', () => {
  it('re-emits each pending event via EventEmitter2 and marks it delivered', async () => {
    outboxRepository.claimPendingBatch.mockResolvedValue([
      outboxEvent({ id: 7, eventType: 'movement.saved', payload: { movementId: 1 } }),
    ]);
    eventEmitter.emitAsync.mockResolvedValue([]);

    await scheduler.relay();

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith('movement.saved', { movementId: 1 });
    expect(outboxRepository.markDelivered).toHaveBeenCalledWith(7);
  });

  it('marks the event failed with backoff when a handler throws (no loss)', async () => {
    outboxRepository.claimPendingBatch.mockResolvedValue([outboxEvent({ id: 8 })]);
    eventEmitter.emitAsync.mockRejectedValue(new Error('handler boom'));

    await scheduler.relay();

    expect(outboxRepository.markFailed).toHaveBeenCalledWith(8, expect.stringContaining('boom'), expect.any(Number));
    expect(outboxRepository.markDelivered).not.toHaveBeenCalled();
  });
});
```

**Step 3: Implementar**

```typescript
@Injectable()
export class OutboxRelayScheduler {
  private static readonly BATCH = 50;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async relay(): Promise<void> {
    const events = await this.outboxRepository.claimPendingBatch(OutboxRelayScheduler.BATCH);
    for (const event of events) {
      try {
        await this.eventEmitter.emitAsync(event.eventType, event.payload);
        await this.outboxRepository.markDelivered(event.id);
      } catch (error) {
        const backoff = Math.min(60 * 2 ** event.attempts, 3600);
        await this.outboxRepository.markFailed(event.id, String(error), backoff);
      }
    }
  }
}
```

`outbox.module.ts` registra `{ provide: OutboxRepository, useClass: TypeOrmOutboxRepository }`,
`DomainEventOutboxPublisher`, `OutboxRelayScheduler`, y exporta el publisher + el repo.
Importar `OutboxModule` en `MovementModule` (para el publisher) y en `app.module.ts`.

**Step 4: Confirmar PASS.**

---

## AC-3 — Idempotencia en escrituras de usuario

### Tarea 9: Entidad `IdempotencyKey` + migración + data-source [X]

**Archivos:**
- Crear: `apps/finances/src/idempotency/domain/idempotency-key/idempotency-key.entity.ts`
- Crear: `apps/finances/src/idempotency/infrastructure/adapters/persistence/typeorm/typeorm-idempotency-key.entity.ts`
- Crear: mapper
- Crear: `apps/finances/src/database/migrations/1784073600022-CreateIdempotencyKeysTable.ts`
- Modificar: `apps/finances/src/database/data-source.ts`

**Step 3: Implementar** — modelo exacto de `docs/data-model.md` §IdempotencyKey
(tabla `idempotency_keys`, único `(user_id, idempotency_key)`, índice `expires_at`,
`status` PENDING/COMPLETED, `response_status`/`response_body` nullable). Migración `...022`.

---

### Tarea 10: Puerto `IdempotencyRepository` + adapter [X]

**Archivos:**
- Crear: `apps/finances/src/idempotency/domain/idempotency-key/idempotency.repository.ts`
- Crear: `apps/finances/src/idempotency/infrastructure/adapters/persistence/typeorm/typeorm-idempotency.repository.ts`
- Test: `.../typeorm-idempotency.repository.spec.ts`

**Puerto:**

```typescript
export abstract class IdempotencyRepository {
  /**
   * Try to reserve a key. Inserts a PENDING row; on unique conflict returns the
   * existing record so the caller can decide replay (COMPLETED) vs in-progress
   * (PENDING) vs conflict (different hash).
   */
  abstract reserve(record: {
    idempotencyKey: string;
    userId: number;
    endpoint: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<{ created: boolean; existing?: IdempotencyKey }>;

  abstract complete(id: number, responseStatus: number, responseBody: unknown): Promise<void>;

  abstract deleteExpired(now: Date): Promise<number>;
}
```

**Test:** `reserve` devuelve `created:true` la primera vez y `created:false` + `existing`
en el segundo intento con la misma `(userId, key)`.

---

### Tarea 11: `IdempotencyInterceptor` [X]

**Archivos:**
- Crear: `apps/finances/src/idempotency/infrastructure/adapters/http/idempotency.interceptor.ts`
- Crear: `apps/finances/src/idempotency/domain/idempotency-key/idempotency.exception.ts` (`IdempotencyConflictException` 422, `IdempotencyInProgressException` 409)
- Crear: `apps/finances/src/idempotency/idempotency.module.ts`
- Modificar: `apps/finances/src/app.module.ts` (importar `IdempotencyModule`)
- Test: `apps/finances/src/idempotency/infrastructure/adapters/http/idempotency.interceptor.spec.ts`

**Step 1: Tests que fallan (uno por rama — AC-3)**

```typescript
describe('IdempotencyInterceptor (AC-3)', () => {
  it('passes through when no Idempotency-Key header is present', async () => { /* next.handle called, no repo access */ });

  it('stores the response and returns it on first use of a key', async () => {
    repo.reserve.mockResolvedValue({ created: true });
    // next.handle emits { id: 1 }
    const out = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(repo.complete).toHaveBeenCalledWith(expect.any(Number), 201, { id: 1 });
    expect(out).toEqual({ id: 1 });
  });

  it('replays the stored response when same key + same body hash (COMPLETED)', async () => {
    repo.reserve.mockResolvedValue({ created: false, existing: completed({ requestHash: HASH, responseStatus: 201, responseBody: { id: 1 } }) });
    const out = await lastValueFrom(interceptor.intercept(ctxWithSameBody, next));
    expect(out).toEqual({ id: 1 });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('throws 422 when same key + different body hash', async () => {
    repo.reserve.mockResolvedValue({ created: false, existing: completed({ requestHash: 'other' }) });
    await expect(lastValueFrom(interceptor.intercept(ctxWithDifferentBody, next)))
      .rejects.toBeInstanceOf(IdempotencyConflictException);
  });

  it('throws 409 when the existing key is still PENDING (in progress)', async () => {
    repo.reserve.mockResolvedValue({ created: false, existing: pending({ requestHash: HASH }) });
    await expect(lastValueFrom(interceptor.intercept(ctxWithSameBody, next)))
      .rejects.toBeInstanceOf(IdempotencyInProgressException);
  });
});
```

**Step 3: Implementar** — el interceptor:
1. Lee `Idempotency-Key` del request; si falta → `next.handle()` sin tocar el repo.
2. Calcula `requestHash = sha256(canonicalJson(body))`; `endpoint = method + ' ' + route`;
   `userId` de `request.user`.
3. `reserve(...)` con `expiresAt = now + 24h`.
   - `created` → ejecuta `next.handle()`, en `tap`/`map` captura status+body y llama `complete(...)`.
   - `existing.status === COMPLETED` y hash igual → devuelve `existing.responseBody` con su status (replay).
   - `existing` con hash distinto → `IdempotencyConflictException` (422).
   - `existing.status === PENDING` y hash igual → `IdempotencyInProgressException` (409).

`idempotency.module.ts` registra el repo (`useClass`), las excepciones no necesitan
provider, y exporta el interceptor.

**Step 4: Confirmar PASS.**

---

### Tarea 12: Aplicar el interceptor a `POST /movements` y `POST /transfers` [X]

**Archivos:**
- Modificar: `apps/finances/src/movement/infrastructure/adapters/http/movement.controller.ts` (`@UseInterceptors(IdempotencyInterceptor)` en `save`)
- Modificar: `apps/finances/src/transfer/infrastructure/adapters/http/transfer.controller.ts` (en `create`)
- Modificar: `movement.module.ts` y `transfer.module.ts` (importar `IdempotencyModule`)
- Test: e2e/controller test opcional; la lógica ya está cubierta en Tarea 11.

**Step 3:** decorar solo los endpoints de creación de escritura de usuario. No aplicar a
GET/PATCH/DELETE.

---

### Tarea 13: `IdempotencyPurgeScheduler` (retención 24h) [X]

**Archivos:**
- Crear: `apps/finances/src/idempotency/infrastructure/adapters/schedulers/idempotency-purge.scheduler.ts`
- Modificar: `idempotency.module.ts` (registrar el scheduler)
- Test: `.../idempotency-purge.scheduler.spec.ts`

**Step 1: Test que falla**

```typescript
it('deletes idempotency keys whose expires_at is in the past (AC-3)', async () => {
  await scheduler.purge();
  expect(repo.deleteExpired).toHaveBeenCalledWith(expect.any(Date));
});
```

**Step 3: Implementar** — `@Cron(CronExpression.EVERY_HOUR)` que llama `repo.deleteExpired(new Date())`.

---

## AC-4 — Reglas de auto-categorización

### Tarea 14: Flag `system` en category + seed "Sin categorizar" [X]

**Archivos:**
- Modificar: `apps/finances/src/category/domain/category/category.entity.ts` (agregar `system: boolean`)
- Modificar: entidad TypeORM de category + mapper
- Crear: `apps/finances/src/database/migrations/1784073600023-AddCategorySystemAndSeedDefault.ts`
- Modificar: `category.repository.ts` (agregar `findSystemDefault(): Promise<Nullable<Category>>`) + adapter
- Test: `.../typeorm-category.repository.spec.ts` (extender: `findSystemDefault` devuelve la sembrada)

**Step 3: Implementar** — usar `docs/data-model.md` §Category: `ADD system boolean NOT NULL
DEFAULT false` + `INSERT ... ('Sin categorizar', ..., true)`. Migración `...023`.
`findSystemDefault` filtra `system = true`.

> Además: proteger que la categoría `system` no se pueda eliminar por la API
> (`RemoveCategoryUsecase` lanza `DomainConflictException` si `category.system`).

---

### Tarea 15: Entidad `CategorizationRule` + migración + data-source [X]

**Archivos:**
- Crear: `apps/finances/src/categorization-rule/domain/categorization-rule/categorization-rule.entity.ts`
- Crear: entidad TypeORM + mapper
- Crear: `apps/finances/src/database/migrations/1784073600024-CreateCategorizationRulesTable.ts`
- Modificar: `apps/finances/src/database/data-source.ts`

**Step 3:** modelo exacto de `docs/data-model.md` §CategorizationRule (tabla
`categorization_rules`, índice `(user_id, priority)`, soft-delete por `BaseEntity`). Migración `...024`.

---

### Tarea 16: DTOs de reglas (`api.yaml` → DTO) [X]

**Archivos:**
- Crear: `apps/finances/src/categorization-rule/application/dto/categorization-rule-input.dto.ts`
- Crear: `apps/finances/src/categorization-rule/application/dto/categorization-rule-update-input.dto.ts`
- Crear: `apps/finances/src/categorization-rule/application/dto/categorization-rule-output.dto.ts`
- Crear: `.../dto/index.ts`

**Step 3: Implementar** (mapeo desde `docs/api.yaml`):

`CategorizationRuleInputDto` — `pattern` (`@IsNotEmpty()`+`@IsString()`), `categoryId`
(`@IsNotEmpty()`+`@IsInt()`), `subcategoryId?` (`@IsOptional()`+`@IsInt()`), `priority?`
(`@IsOptional()`+`@IsInt()`, default 0).

`CategorizationRuleUpdateInputDto` — todos opcionales (`@IsOptional()` + validador de tipo).

`CategorizationRuleOutputDto` — `id`, `pattern`, `categoryId`, `subcategoryId?`, `priority`,
`createdAt` (campos planos, sin validadores).

---

### Tarea 17: Puerto + adapter + CRUD use cases de reglas [X]

**Archivos:**
- Crear: `apps/finances/src/categorization-rule/domain/categorization-rule/categorization-rule.repository.ts` (abstract)
- Crear: adapter TypeORM
- Crear: usecases `create-categorization-rule`, `find-all-categorization-rules`, `update-categorization-rule`, `remove-categorization-rule`
- Test: un spec por usecase

**Puerto:**

```typescript
export abstract class CategorizationRuleRepository {
  abstract findByUserOrderByPriorityDesc(user: number): Promise<CategorizationRule[]>;
  abstract findByIdAndUser(id: number, user: number): Promise<Nullable<CategorizationRule>>;
  abstract save(rule: CategorizationRule): Promise<CategorizationRule>;
  abstract softRemove(id: number, user: number): Promise<boolean>;
}
```

**Tests (mapean AC-4 y scope por usuario):**
- create valida que la categoría exista (404 si no) y persiste con `user`.
- find-all devuelve solo reglas del usuario, ordenadas por prioridad desc.
- update solo sobre reglas del usuario (404 si no).
- remove soft-borra (404 si no).

---

### Tarea 18: `ApplyCategorizationRulesUsecase` (matcher + default) [X]

**Archivos:**
- Crear: `apps/finances/src/categorization-rule/application/usecases/apply-categorization-rules.usecase.ts`
- Test: `.../apply-categorization-rules.usecase.spec.ts`

**Step 1: Tests que fallan (AC-4)**

```typescript
describe('ApplyCategorizationRulesUsecase (AC-4)', () => {
  it('matches by case-insensitive substring on merchant', async () => {
    ruleRepo.findByUserOrderByPriorityDesc.mockResolvedValue([
      rule({ pattern: 'uber', categoryId: 10, priority: 1 }),
    ]);
    const r = await usecase.execute({ merchant: 'UBER TRIP 123', description: '' }, 42);
    expect(r).toEqual({ categoryId: 10, subcategoryId: undefined });
  });

  it('matches on description when merchant does not', async () => {
    ruleRepo.findByUserOrderByPriorityDesc.mockResolvedValue([rule({ pattern: 'netflix', categoryId: 20 })]);
    const r = await usecase.execute({ merchant: '', description: 'NETFLIX.COM' }, 42);
    expect(r.categoryId).toBe(20);
  });

  it('the highest-priority rule wins when several match', async () => {
    ruleRepo.findByUserOrderByPriorityDesc.mockResolvedValue([
      rule({ pattern: 'a', categoryId: 99, priority: 10 }),
      rule({ pattern: 'a', categoryId: 1, priority: 1 }),
    ]);
    const r = await usecase.execute({ merchant: 'aaa', description: '' }, 42);
    expect(r.categoryId).toBe(99);
  });

  it('falls back to the system default category when no rule matches', async () => {
    ruleRepo.findByUserOrderByPriorityDesc.mockResolvedValue([]);
    categoryRepo.findSystemDefault.mockResolvedValue(category({ id: 7, name: 'Sin categorizar', system: true }));
    const r = await usecase.execute({ merchant: 'x', description: 'y' }, 42);
    expect(r.categoryId).toBe(7);
  });
});
```

**Step 3: Implementar**

```typescript
async execute(input: { merchant?: string; description?: string }, user: number) {
  const haystack = `${input.merchant ?? ''} ${input.description ?? ''}`.toLowerCase();
  const rules = await this.ruleRepository.findByUserOrderByPriorityDesc(user);
  const match = rules.find((r) => haystack.includes(r.pattern.toLowerCase()));
  if (match) return { categoryId: match.categoryId, subcategoryId: match.subcategoryId };

  const fallback = await this.categoryRepository.findSystemDefault();
  if (!fallback) throw new SystemDefaultCategoryMissingException();
  return { categoryId: fallback.id, subcategoryId: undefined };
}
```

`findByUserOrderByPriorityDesc` ya ordena, así que `find` toma la de mayor prioridad.

---

### Tarea 19: Controller de reglas + enganche en webhook y save-movement [X]

**Archivos:**
- Crear: `apps/finances/src/categorization-rule/infrastructure/adapters/http/categorization-rule.controller.ts`
- Crear: `apps/finances/src/categorization-rule/categorization-rule.module.ts`
- Modificar: `apps/finances/src/app.module.ts` (importar el módulo)
- Modificar: `apps/finances/src/webhook/application/usecases/receive-webhook-transaction.usecase.ts` (si no viene category → `ApplyCategorizationRulesUsecase`)
- Modificar: `apps/finances/src/movement/application/usecases/save-movement.usecase.ts` (si `categoryId` ausente → aplicar reglas)
- Modificar: `webhook.module.ts` y `movement.module.ts` (importar `CategorizationRuleModule`)
- Test: controller spec (CRUD, scope `@CurrentUser`) + extender webhook/save-movement specs

**Controller** — 4 endpoints de `api.yaml` (`POST`, `GET`, `PATCH /:id`, `DELETE /:id`),
todos con `@CurrentUser() user`, delegando a los usecases de Tarea 17.

**Enganche (AC-4):** en webhook y en save-movement, cuando el movimiento entra sin
`categoryId`, resolver con `ApplyCategorizationRulesUsecase.execute({ merchant, description }, user)`
antes de guardar. Test webhook: un movimiento entrante sin categoría que matchea una regla
queda categorizado; sin match → categoría por defecto.

---

## AC-5 — Política de archivado de cuentas en cascada

### Tarea 20: `RemoveAccountUsecase` — soft-delete en cascada [X]

**Archivos:**
- Modificar: `apps/finances/src/account/application/usecases/remove-account.usecase.ts`
- Modificar: `apps/finances/src/account/domain/account/account.repository.ts` (`softRemove` ahora cascada, o nuevo método transaccional)
- Modificar: `apps/finances/src/movement/domain/movement/movement.repository.ts` (métodos de soft-delete por cuenta y por transferGroup)
- Modificar: adapters TypeORM correspondientes
- Modificar: `apps/finances/src/account/application/dto/` → crear `account-archived-output.dto.ts`
- Test: `apps/finances/src/account/application/usecases/remove-account.usecase.spec.ts` (reescribir)

**Step 1: Tests que fallan (AC-5)**

```typescript
describe('RemoveAccountUsecase — cascade archive (AC-5)', () => {
  it('soft-deletes the account and its movements instead of blocking', async () => {
    accountRepository.findByIdAndUser.mockResolvedValue(account({ id: 1 }));
    movementRepository.softDeleteByAccount.mockResolvedValue(3);
    movementRepository.softDeleteTransferGroupsByAccount.mockResolvedValue(2);

    const result = await usecase.execute(1, 42);

    expect(accountRepository.softRemove).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({ accountId: 1, archivedMovements: 3, archivedTransfers: 2 });
  });

  it('soft-deletes both legs of every transfer group even if the counterpart account is active', async () => {
    accountRepository.findByIdAndUser.mockResolvedValue(account({ id: 1 }));
    await usecase.execute(1, 42);
    expect(movementRepository.softDeleteTransferGroupsByAccount).toHaveBeenCalledWith(1, 42, expect.anything());
  });

  it('no longer throws AccountHasMovementsException', async () => {
    accountRepository.findByIdAndUser.mockResolvedValue(account({ id: 1 }));
    await expect(usecase.execute(1, 42)).resolves.toBeDefined();
  });

  it('404 when the account does not belong to the user', async () => {
    accountRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, 42)).rejects.toBeInstanceOf(AccountNotFoundException);
  });
});
```

**Step 3: Implementar** — dentro de una transacción:
1. `softDeleteTransferGroupsByAccount(accountId, user, manager)` → borra ambas patas de cada
   `transferGroup` en el que participa un movimiento de la cuenta (subquery por `transfer_group`).
2. `softDeleteByAccount(accountId, user, manager)` → borra los movimientos restantes de la cuenta.
3. `accountRepository.softRemove(accountId, user)` (dentro del mismo `manager`).
Devolver `AccountArchivedOutputDto { accountId, archivedMovements, archivedTransfers }`.
Eliminar el chequeo `hasMovements` que lanzaba `AccountHasMovementsException`.

---

### Tarea 21: Excluir movimientos soft-deleted de los cálculos + controller [X]

**Archivos:**
- Modificar: `apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.repository.ts` (queries SQL crudas de `movementBalance`, `movementBalancesByUser`, `hasMovements`)
- Modificar: `apps/finances/src/account/infrastructure/adapters/http/account.controller.ts` (DELETE devuelve `AccountArchivedOutputDto`, 200)
- Test: `.../typeorm-account.repository.spec.ts` (extender)

**Step 1: Test que falla**

```typescript
it('excludes soft-deleted movements from movementBalance (AC-5)', async () => {
  // seed: 2 movimientos, uno con deleted_at != null
  const balance = await repository.movementBalance(accountId, user);
  expect(balance).toBe(/* solo el movimiento vivo */);
});
```

**Step 3: Implementar** — agregar `AND deleted_at IS NULL` a las tres queries crudas.
Controller DELETE: retornar el DTO con `@HttpCode(200)`.

**Step 4: Confirmar PASS.**

---

### Tarea 22: Correr la suite completa del módulo afectado [X]

```bash
cd apps/finances
npx jest src/account src/transfer src/movement src/budget src/category src/outbox src/idempotency src/categorization-rule src/webhook --no-coverage
cd ../..
```
Esperado: PASS — todos los tests de los módulos tocados por sm-0003 pasando.

Además, verificar que las migraciones corren limpio contra una DB fresca:

```bash
cd apps/finances
npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
cd ../..
```
Esperado: las 5 migraciones (`...020`–`...024`) aplican sin error.

---

## Notas de ejecución

- **Sub-entregables:** los 5 ACs son independientes. Si preferís PRs más chicos, ejecutá y
  commiteá por bloque (AC-1, AC-2, …) en vez de todo junto.
- **Excepciones nuevas** sobre la jerarquía de `@shared`: `InsufficientBalanceException` (422),
  `IdempotencyConflictException` (422), `IdempotencyInProgressException` (409),
  `SystemDefaultCategoryMissingException`. Nunca lanzar `Error` crudo (skill `error-handling`).
- **Registro:** cada módulo nuevo (`outbox`, `idempotency`, `categorization-rule`) debe
  importarse en `app.module.ts` y sus entidades TypeORM registrarse en `data-source.ts`.
- **Consistencia eventual:** al mover el emit de `movement.saved` al relay (Tarea 7–8), las
  notificaciones de presupuesto pasan a depender del intervalo del cron (~10s). Es la decisión
  registrada en `docs/research.md`.
- **`AccountHasMovementsException`** queda sin uso tras AC-5 — revisar si borrarla.
