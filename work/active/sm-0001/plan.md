# sm-0001: Cerrar huecos de features a medias — Plan de Implementación

> **Para Claude:** USA el skill /build para implementar este plan tarea por tarea.

**Historia:** `work/active/sm-0001/`
**Microservicio(s):** `finances` (mono-repo Nx) · toques cross-lib en `@shared` y dependencia externa en `exchanges`/`users`
**Objetivo:** Cerrar las 6 features a medias del Grupo A: notificación de umbral entregable, conversión de moneda, saldo vivo por cuenta, edición de movimientos, CRUD de scheduled + anular transferencia, y reversa de webhook.
**Arquitectura:** Hexagonal por módulo (domain/application/infrastructure). Puertos como `abstract class`, un usecase por acción, mappers dominio↔TypeORM. Enum-like como varchar. Todo scopeado por `user.id`.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest

**Fragmentación por lotes** (condición de la excepción de Simplicity aprobada en `/design`):
- **Lote 1 — AC-3** (saldo vivo) · autocontenido
- **Lote 2 — AC-4** (PATCH movimientos) · autocontenido
- **Lote 3 — AC-5** (editar scheduled + anular transferencia) · autocontenido
- **Lote 4 — AC-6** (reversa webhook) · autocontenido
- **Lote 5 — AC-1** (notificación PGMQ + columna budgets) · infra nueva
- **Lote 6 — AC-2** (conversión de moneda) · ⚠️ depende de `exchanges` reactivado + claim en JWT (`users`/`@shared`)

> Orden de implementación: de lo autocontenido a lo dependiente de infra/otros micros (Lotes 1→6). Ejecutá y validá cada lote antes del siguiente.

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 21, 22, 23, 24, 25 |
| AC-2 | Tarea 26, 27, 28, 29, 30, 31 |
| AC-3 | Tarea 1, 2, 3, 4, 5, 6 |
| AC-4 | Tarea 7, 8, 9 |
| AC-5 | Tarea 10, 11, 12, 13, 14, 15, 16, 17 |
| AC-6 | Tarea 18, 19, 20 |

---

### Tarea 0: Preparar rama de trabajo [X]

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: `feat/SM-0001-close-half-built-features`)"

**Step 1: Verificar base (read-only)**
```bash
git branch --show-current
git status --porcelain
```
Esperado: si no estás sobre la base fresca esperada o el working tree está sucio, evaluá `/sync` antes. (Este repo trabaja sobre `feat/core`; confirmá con el usuario si la rama parte de ahí o de `master`.)

**Step 2: Crear rama**
```bash
git checkout -b <nombre-de-rama-dado-por-usuario>
```
Esperado: rama nueva creada y activa.

---

## LOTE 1 — AC-3: Saldo vivo por cuenta

> Nota de diseño para evitar ciclo de módulos: el saldo suma movimientos, pero `MovementModule`
> ya importa `AccountModule`. Para no crear un ciclo, `AccountModule` registra
> `TypeOrmMovementEntity` en su `forFeature` y `TypeOrmAccountRepository` inyecta ese repo
> para la agregación — sin importar `MovementModule`.

### Tarea 1: DTOs de saldo de cuenta [X]

**Archivos:**
- Crear: `apps/finances/src/account/application/dto/account-balance-output.dto.ts`
- Modificar: `apps/finances/src/account/application/dto/account-output.dto.ts`
- Modificar: `apps/finances/src/account/application/dto/index.ts`

**Step 1: Crear `AccountBalanceOutputDto`** (response, sin validadores)
```typescript
export class AccountBalanceOutputDto {
  accountId: number;
  balance: number;
  currency: string;
}
```

**Step 2: Agregar `balance` a `AccountOutputDto`**
```typescript
export class AccountOutputDto {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  initialBalance: number;
  currency: string;
  balance: number; // AC-3: initialBalance + suma firmada de movimientos
  user: number;
}
```

**Step 3: Exportar en el barrel**
```typescript
export * from './account-input.dto';
export * from './account-output.dto';
export * from './account-filter.dto';
export * from './account-balance-output.dto';
```
(DTOs de respuesta puros: sin test unitario.)

### Tarea 2: Puerto — métodos de saldo en `AccountRepository` [X]

**Archivos:**
- Modificar: `apps/finances/src/account/domain/account/account.repository.ts`

**Step 1: Test que falla** — `apps/finances/src/account/domain/account/account.repository.spec.ts`
```typescript
import { AccountRepository } from './account.repository';

describe('AccountRepository (puerto)', () => {
  it('declara movementBalance y movementBalancesByUser', () => {
    const methods = Object.getOwnPropertyNames(AccountRepository.prototype);
    expect(methods).toEqual(
      expect.arrayContaining(['movementBalance', 'movementBalancesByUser']),
    );
  });
});
```
(Puerto abstracto sin cuerpo: este test es opcional; si no aporta, omitir y validar vía la impl en Tarea 3.)

**Step 2: Agregar firmas**
```typescript
export abstract class AccountRepository {
  abstract findByIdAndUser(id: number, user: number): Promise<Nullable<Account>>;
  abstract findAllByUser(user: number): Promise<Account[]>;
  abstract save(account: Account): Promise<Account>;
  abstract softRemove(id: number, user: number): Promise<boolean>;
  abstract hasMovements(id: number): Promise<boolean>;

  /** Suma firmada de movimientos de la cuenta: INCOME/TRANSFER_IN suman,
   * EXPENSE/TRANSFER_OUT restan; excluye soft-deleted. NO incluye initialBalance. */
  abstract movementBalance(accountId: number, user: number): Promise<number>;

  /** Igual que movementBalance pero para todas las cuentas del usuario, indexado por accountId. */
  abstract movementBalancesByUser(user: number): Promise<Record<number, number>>;
}
```

### Tarea 3: Adapter — implementar la agregación en `TypeOrmAccountRepository` [X]

**Archivos:**
- Modificar: `apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.repository.ts`
- Test: `.../typeorm-account.repository.spec.ts`

**Step 1: Test que falla** (integración con repo mockeado del query builder o test unitario del CASE)
```typescript
describe('TypeOrmAccountRepository.movementBalance', () => {
  it('suma INCOME/TRANSFER_IN y resta EXPENSE/TRANSFER_OUT, sin soft-deleted', async () => {
    // arrange: un createQueryBuilder mockeado que devuelve { total: '150.00' }
    const getRawOne = jest.fn().mockResolvedValue({ total: '150.00' });
    const qb = { select: () => qb, where: () => qb, andWhere: () => qb, getRawOne } as any;
    const movementRepo = { createQueryBuilder: () => qb } as any;
    const repo = new TypeOrmAccountRepository({} as any, movementRepo);
    // act
    const balance = await repo.movementBalance(1, 7);
    // assert
    expect(balance).toBe(150);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**
```bash
npx jest apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.repository.spec.ts --no-coverage
```
Esperado: FAIL — `movementBalance is not a function`.

**Step 3: Implementar** (inyectar el repo de movimientos y usar CASE firmado)
```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmMovementEntity } from '../../../../../../movement/infrastructure/adapters/persistence/typeorm/movement';

// en el constructor, además del repo de cuentas:
constructor(
  @InjectRepository(TypeOrmAccountEntity)
  private readonly repository: Repository<TypeOrmAccountEntity>,
  @InjectRepository(TypeOrmMovementEntity)
  private readonly movementRepository: Repository<TypeOrmMovementEntity>,
) {}

private static readonly SIGNED_SUM =
  `COALESCE(SUM(CASE WHEN m.type IN ('INCOME','TRANSFER_IN') THEN m.amount ` +
  `WHEN m.type IN ('EXPENSE','TRANSFER_OUT') THEN -m.amount ELSE 0 END), 0)`;

async movementBalance(accountId: number, user: number): Promise<number> {
  const row = await this.movementRepository
    .createQueryBuilder('m')
    .select(TypeOrmAccountRepository.SIGNED_SUM, 'total')
    .where('m.account_id = :accountId', { accountId })
    .andWhere('m.user_id = :user', { user })
    .andWhere('m.deleted_at IS NULL')
    .getRawOne<{ total: string }>();
  return Number(row.total);
}

async movementBalancesByUser(user: number): Promise<Record<number, number>> {
  const rows = await this.movementRepository
    .createQueryBuilder('m')
    .select('m.account_id', 'accountId')
    .addSelect(TypeOrmAccountRepository.SIGNED_SUM, 'total')
    .where('m.user_id = :user', { user })
    .andWhere('m.deleted_at IS NULL')
    .groupBy('m.account_id')
    .getRawMany<{ accountId: number; total: string }>();
  return rows.reduce((acc, r) => ({ ...acc, [r.accountId]: Number(r.total) }), {});
}
```

**Step 4: Confirmar que pasa**
```bash
npx jest apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.repository.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 4: Usecase `GetAccountBalanceUsecase` [X]

**Archivos:**
- Crear: `apps/finances/src/account/application/usecases/get-account-balance.usecase.ts`
- Modificar: `apps/finances/src/account/application/usecases/index.ts`
- Test: `.../get-account-balance.usecase.spec.ts`

**Step 1: Test que falla**
```typescript
describe('GetAccountBalanceUsecase', () => {
  const account = { id: 1, initialBalance: 100, currency: 'COP' };
  const accountRepo = {
    findByIdAndUser: jest.fn().mockResolvedValue(account),
    movementBalance: jest.fn().mockResolvedValue(50),
  } as any;
  const usecase = new GetAccountBalanceUsecase(accountRepo);

  it('devuelve initialBalance + suma de movimientos (AC-3)', async () => {
    const result = await usecase.execute(1, 7);
    expect(result).toEqual({ accountId: 1, balance: 150, currency: 'COP' });
  });

  it('lanza AccountNotFoundException si la cuenta es de otro usuario (AC-3 scoping)', async () => {
    accountRepo.findByIdAndUser.mockResolvedValueOnce(null);
    await expect(usecase.execute(1, 7)).rejects.toThrow(AccountNotFoundException);
  });
});
```

**Step 2: Confirmar que falla**
```bash
npx jest apps/finances/src/account/application/usecases/get-account-balance.usecase.spec.ts --no-coverage
```
Esperado: FAIL — Cannot find module.

**Step 3: Implementar**
```typescript
import { Injectable } from '@nestjs/common';
import { AccountBalanceOutputDto } from '../dto';
import { AccountNotFoundException, AccountRepository } from '../../domain/account';

@Injectable()
export class GetAccountBalanceUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(id: number, user: number): Promise<AccountBalanceOutputDto> {
    const account = await this.accountRepository.findByIdAndUser(id, user);
    if (!account) throw new AccountNotFoundException('Account not found');
    const movementBalance = await this.accountRepository.movementBalance(id, user);
    return {
      accountId: account.id,
      balance: account.initialBalance + movementBalance,
      currency: account.currency,
    };
  }
}
```

**Step 4: Confirmar que pasa**
```bash
npx jest apps/finances/src/account/application/usecases/get-account-balance.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 5: Enriquecer `FindAllAccountsUsecase` + mapper con saldo embebido [X]

**Archivos:**
- Modificar: `apps/finances/src/account/application/usecases/find-all-accounts.usecase.ts`
- Modificar: `apps/finances/src/account/application/mappers/*` (AccountMapper.toOutput debe aceptar balance)
- Test: `.../find-all-accounts.usecase.spec.ts`

**Step 1: Test que falla**
```typescript
it('adjunta el saldo a cada cuenta (AC-3 embebido en listado)', async () => {
  const accountRepo = {
    findAllByUser: jest.fn().mockResolvedValue([{ id: 1, initialBalance: 100, currency: 'COP' }]),
    movementBalancesByUser: jest.fn().mockResolvedValue({ 1: 50 }),
  } as any;
  const usecase = new FindAllAccountsUsecase(accountRepo);
  const [account] = await usecase.execute(7);
  expect(account.balance).toBe(150);
});
```

**Step 3: Implementar** — el usecase pide `movementBalancesByUser`, y para cada cuenta arma `balance = initialBalance + (map[id] ?? 0)`. `AccountMapper.toOutput` recibe el balance (o el usecase devuelve el DTO ya con balance). Mantener el patrón actual del mapper.

**Step 4: Confirmar que pasa**
```bash
npx jest apps/finances/src/account/application/usecases/find-all-accounts.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 6: Controller + registro en `AccountModule` [X]

**Archivos:**
- Modificar: `apps/finances/src/account/infrastructure/adapters/http/account.controller.ts`
- Modificar: `apps/finances/src/account/account.module.ts`

**Step 1: Test e2e/unit del controller** (mockear usecase)
```typescript
it('GET /accounts/:id/balance devuelve el saldo (AC-3)', async () => {
  const usecase = { execute: jest.fn().mockResolvedValue({ accountId: 1, balance: 150, currency: 'COP' }) } as any;
  const controller = new AccountController(/* find */ {} as any, {} as any, {} as any, {} as any, usecase);
  const result = await controller.balance({ id: 7 } as any, 1);
  expect(result).toEqual({ accountId: 1, balance: 150, currency: 'COP' });
});
```

**Step 3: Implementar** — agregar al controller:
```typescript
@Get(':id/balance')
async balance(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') id: number,
): Promise<AccountBalanceOutputDto> {
  return this.getAccountBalanceUsecase.execute(id, user.id);
}
```
Registrar en `account.module.ts`:
```typescript
imports: [TypeOrmModule.forFeature([TypeOrmAccountEntity, TypeOrmMovementEntity])],
providers: [
  { provide: AccountRepository, useClass: TypeOrmAccountRepository },
  FindAccountUsecase, FindAllAccountsUsecase, SaveAccountUsecase,
  RemoveAccountUsecase, GetAccountBalanceUsecase,
],
```
(Importar `TypeOrmMovementEntity` desde el módulo de movimientos.)

**Step 4: Correr los tests del módulo**
```bash
npx jest apps/finances/src/account/ --no-coverage
```
Esperado: PASS.

---

## LOTE 2 — AC-4: Edición de movimientos (`PATCH /movements/:id`)

### Tarea 7: DTO `MovementPatchDto` [X]

**Archivos:**
- Crear: `apps/finances/src/movement/application/dto/movement-patch.dto.ts`
- Modificar: `apps/finances/src/movement/application/dto/index.ts`

**Step 1: Implementar** (todos opcionales; sin `type` ni `account`)
```typescript
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../../domain/movement';

export class MovementPatchDto {
  @IsOptional() date?: Date;
  @IsOptional() @IsInt() category?: number;
  @IsOptional() @IsInt() subcategory?: number;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}
```
Exportar en el barrel. (Sin test unitario de DTO.)

### Tarea 8: Usecase `UpdateMovementUsecase` [X]

**Archivos:**
- Crear: `apps/finances/src/movement/application/usecases/update-movement.usecase.ts`
- Modificar: `apps/finances/src/movement/application/usecases/index.ts`
- Crear excepción si hace falta: `MovementNotEditableException` en `movement.exception.ts`
- Test: `.../update-movement.usecase.spec.ts`

**Step 1: Tests que fallan (cubren AC-4 completo)**
```typescript
describe('UpdateMovementUsecase', () => {
  const base = { id: 1, type: MovementType.EXPENSE, source: MovementSource.MANUAL,
    categoryId: 3, merchant: 'Uber', notes: 'x', user: 7 };
  let movementRepo, categoryRepo, subcategoryRepo, usecase;
  beforeEach(() => {
    movementRepo = { findByIdAndUser: jest.fn(), save: jest.fn((m) => m) };
    subcategoryRepo = { findByIdAndCategory: jest.fn().mockResolvedValue({ id: 9 }) };
    usecase = new UpdateMovementUsecase(movementRepo, subcategoryRepo);
  });

  it('404 si el movimiento es de otro usuario', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue(null);
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(MovementNotFoundException);
  });

  it('422 si el movimiento es una pata de transferencia', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue({ ...base, type: MovementType.TRANSFER_OUT });
    await expect(usecase.execute(1, { notes: 'y' }, 7)).rejects.toThrow(MovementNotEditableException);
  });

  it('422 si source=WEBHOOK y se intenta tocar amount', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue({ ...base, source: MovementSource.WEBHOOK });
    await expect(usecase.execute(1, { amount: 999 }, 7)).rejects.toThrow(MovementNotEditableException);
  });

  it('permite notes/categoría en un movimiento WEBHOOK', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue({ ...base, source: MovementSource.WEBHOOK });
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect(result.notes).toBe('nuevo');
    expect(movementRepo.save).toHaveBeenCalled();
  });

  it('editar notes no borra el merchant de ingesta', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue({ ...base });
    const result = await usecase.execute(1, { notes: 'nuevo' }, 7);
    expect(result.merchant).toBe('Uber');
  });

  it('valida subcategoría ∈ categoría al reasignar', async () => {
    movementRepo.findByIdAndUser.mockResolvedValue({ ...base });
    subcategoryRepo.findByIdAndCategory.mockResolvedValue(null);
    await expect(usecase.execute(1, { subcategory: 9, category: 3 }, 7))
      .rejects.toThrow(SubcategoryNotFoundException);
  });
});
```

**Step 3: Implementar**
```typescript
import { Injectable } from '@nestjs/common';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import {
  Movement, MovementNotEditableException, MovementNotFoundException,
  MovementRepository, MovementSource, MovementType,
} from '../../domain/movement';
import { MovementPatchDto } from '../dto';

const WEBHOOK_EDITABLE = new Set(['notes', 'category', 'subcategory', 'paymentMethod']);
const TRANSFER_TYPES = new Set([MovementType.TRANSFER_IN, MovementType.TRANSFER_OUT]);

@Injectable()
export class UpdateMovementUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
  ) {}

  async execute(id: number, patch: MovementPatchDto, user: number): Promise<Movement> {
    const movement = await this.movementRepository.findByIdAndUser(id, user);
    if (!movement) throw new MovementNotFoundException('Movement not found');

    if (TRANSFER_TYPES.has(movement.type)) {
      throw new MovementNotEditableException('Transfer legs cannot be edited; reverse the transfer instead');
    }

    if (movement.source === MovementSource.WEBHOOK) {
      const touched = Object.keys(patch).filter((k) => patch[k] !== undefined);
      const forbidden = touched.filter((k) => !WEBHOOK_EDITABLE.has(k));
      if (forbidden.length) {
        throw new MovementNotEditableException(
          `Fields extracted by ingestion are read-only: ${forbidden.join(', ')}`,
        );
      }
    }

    if (patch.subcategory !== undefined) {
      const categoryId = patch.category ?? movement.categoryId;
      const sub = await this.subcategoryRepository.findByIdAndCategory(patch.subcategory, categoryId);
      if (!sub) throw new SubcategoryNotFoundException('Subcategory not found');
    }

    movement.update({
      date: patch.date ?? movement.date,
      description: patch.description ?? movement.description,
      notes: patch.notes ?? movement.notes,
      amount: patch.amount ?? movement.amount,
      paymentMethod: patch.paymentMethod ?? movement.paymentMethod,
      categoryId: patch.category ?? movement.categoryId,
      subcategoryId: patch.subcategory ?? movement.subcategoryId,
    });

    return this.movementRepository.save(movement);
  }
}
```
`MovementNotEditableException` en `movement.exception.ts`: mapear a HTTP 422 (seguir el patrón de excepciones de dominio con status del commit `893a1ff`).

**Step 4: Confirmar que pasa**
```bash
npx jest apps/finances/src/movement/application/usecases/update-movement.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 9: Controller `PATCH /movements/:id` + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/movement/infrastructure/adapters/http/movement.controller.ts`
- Modificar: `apps/finances/src/movement/movement.module.ts` (agregar `UpdateMovementUsecase` a providers; importa `CategoryModule` que expone `SubcategoryRepository`)

**Step 3: Implementar**
```typescript
@Patch(':id')
async update(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') id: number,
  @Body() patch: MovementPatchDto,
): Promise<MovementOutputDto> {
  const movement = await this.updateMovementUsecase.execute(id, patch, user.id);
  return MovementMapper.toOutput(movement);
}
```
Registrar el usecase en `movement.module.ts`. Verificar que `CategoryModule` exporte `SubcategoryRepository` (si no, ya está disponible vía el import existente de `CategoryModule`).

**Step 4:**
```bash
npx jest apps/finances/src/movement/ --no-coverage
```
Esperado: PASS.

---

## LOTE 3 — AC-5: Editar scheduled + anular transferencia

### Tarea 10: Puerto — `MovementRepository.findByTransferGroup` [X]

**Archivos:**
- Modificar: `apps/finances/src/movement/domain/movement/movement.repository.ts`

**Step 1: Agregar firma**
```typescript
/** Ambas patas (o el par compensatorio) que comparten un transferGroup, del usuario. */
abstract findByTransferGroup(transferGroup: string, user: number): Promise<Movement[]>;
```

### Tarea 11: Adapter — implementar `findByTransferGroup` [X]

**Archivos:**
- Modificar: `apps/finances/src/movement/infrastructure/adapters/persistence/typeorm/movement/typeorm-movement.repository.ts`
- Test: `.../typeorm-movement.repository.spec.ts`

**Step 1: Test que falla** → busca por `transfer_group` + `user`, ordena por tipo.

**Step 3: Implementar**
```typescript
async findByTransferGroup(transferGroup: string, user: number): Promise<Movement[]> {
  const entities = await this.repository.find({
    where: { transferGroup, user },
    relations: ['category', 'subcategory'],
  });
  return entities.map(TypeOrmMovementMapper.toDomain);
}
```

**Step 4:**
```bash
npx jest apps/finances/src/movement/infrastructure/adapters/persistence/typeorm/movement/typeorm-movement.repository.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 12: DTO `ScheduledPatchDto` [X]

**Archivos:**
- Crear: `apps/finances/src/scheduled/application/dto/scheduled-patch.dto.ts`
- Modificar: `apps/finances/src/scheduled/application/dto/index.ts`

```typescript
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Frequency } from '../../domain/scheduled';

export class ScheduledPatchDto {
  @IsOptional() date?: Date;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsEnum(Frequency) frequency?: Frequency;
  @IsOptional() @IsInt() category?: number;
  @IsOptional() @IsInt() subcategory?: number;
  @IsOptional() @IsInt() account?: number;
  @IsOptional() @IsString() description?: string;
}
```

### Tarea 13: Usecase `UpdateScheduledUsecase` [X]

**Archivos:**
- Crear: `apps/finances/src/scheduled/application/usecases/update-scheduled.usecase.ts`
- Modificar barrel de usecases.
- Test: `.../update-scheduled.usecase.spec.ts`

**Step 1: Tests que fallan**
```typescript
it('404 si el programado es de otro usuario', async () => {
  scheduledRepo.findByIdAndUser.mockResolvedValue(null);
  await expect(usecase.execute(1, { amount: 10 }, 7)).rejects.toThrow(ScheduledNotFoundException);
});
it('actualiza monto/frecuencia sin tocar type (AC-5)', async () => {
  scheduledRepo.findByIdAndUser.mockResolvedValue({ id: 1, type: MovementType.EXPENSE, amount: 5, frequency: Frequency.MONTHLY, update(p){ Object.assign(this,p);} });
  const result = await usecase.execute(1, { amount: 10, frequency: Frequency.WEEKLY }, 7);
  expect(result.amount).toBe(10);
  expect(result.frequency).toBe(Frequency.WEEKLY);
  expect(result.type).toBe(MovementType.EXPENSE);
});
```
> Nota AC-5: editar el template NO toca los movimientos ya materializados (son filas `movements` aparte); no se recalcula nada del pasado. El test lo documenta con un comentario y no invoca ninguna regeneración.

**Step 3: Implementar** — `findByIdAndUser`, validar subcategoría∈categoría si cambia, `scheduled.update({...})` solo con campos provistos, `scheduledRepository.save`.

**Step 4:**
```bash
npx jest apps/finances/src/scheduled/application/usecases/update-scheduled.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 14: Controller `PATCH /scheduled/:id` + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/scheduled/infrastructure/adapters/http/scheduled.controller.ts`
- Modificar: `apps/finances/src/scheduled/scheduled.module.ts`

**Step 3: Implementar** `@Patch(':id')` que llama al usecase y mapea a `ScheduledOutputDto`. Registrar `UpdateScheduledUsecase`.

**Step 4:** `npx jest apps/finances/src/scheduled/ --no-coverage` → PASS.

### Tarea 15: DTO `TransferReversalOutputDto` [X]

**Archivos:**
- Crear: `apps/finances/src/transfer/application/dto/transfer-reversal-output.dto.ts`
- Modificar: `apps/finances/src/transfer/application/dto/index.ts`

```typescript
export class TransferReversalOutputDto {
  originalTransferGroup: string;
  reversalTransferGroup: string;
  fromMovementId: number;
  toMovementId: number;
}
```

### Tarea 16: Usecase `ReverseTransferUsecase` [X]

**Archivos:**
- Crear: `apps/finances/src/transfer/application/usecases/reverse-transfer.usecase.ts`
- Modificar barrel de usecases.
- Crear excepción `TransferNotFoundException` / `TransferAlreadyReversedException` en `transfer/domain`.
- Test: `.../reverse-transfer.usecase.spec.ts`

**Estrategia de idempotencia (sin columna nueva):** el par compensatorio usa
`reversalTransferGroup = 'reversal:' + originalTransferGroup`. Un segundo intento detecta
que ya existen patas con ese group → 409.

**Step 1: Tests que fallan**
```typescript
it('404 si el transferGroup no existe para el usuario', async () => {
  movementRepo.findByTransferGroup.mockResolvedValue([]);
  await expect(usecase.execute('grp', 7)).rejects.toThrow(TransferNotFoundException);
});
it('crea un par compensatorio (OUT↔IN invertidos) con reversalTransferGroup', async () => {
  movementRepo.findByTransferGroup
    .mockResolvedValueOnce([ // original
      { id: 10, type: MovementType.TRANSFER_OUT, accountId: 1, amount: 100, currency: 'COP', transferGroup: 'grp', user: 7 },
      { id: 11, type: MovementType.TRANSFER_IN, accountId: 2, amount: 100, currency: 'COP', transferGroup: 'grp', user: 7 },
    ])
    .mockResolvedValueOnce([]); // no existe reversa aún
  movementRepo.saveAll.mockResolvedValue([{ id: 20 }, { id: 21 }]);
  const result = await usecase.execute('grp', 7);
  expect(result.reversalTransferGroup).toBe('reversal:grp');
  expect(movementRepo.saveAll).toHaveBeenCalled();
});
it('409 si la transferencia ya fue anulada', async () => {
  movementRepo.findByTransferGroup
    .mockResolvedValueOnce([{ id: 10, type: MovementType.TRANSFER_OUT, transferGroup: 'grp', user: 7 }])
    .mockResolvedValueOnce([{ id: 20, transferGroup: 'reversal:grp' }]);
  await expect(usecase.execute('grp', 7)).rejects.toThrow(TransferAlreadyReversedException);
});
```

**Step 3: Implementar**
```typescript
@Injectable()
export class ReverseTransferUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(transferGroup: string, user: number): Promise<TransferReversalOutputDto> {
    const legs = await this.movementRepository.findByTransferGroup(transferGroup, user);
    if (!legs.length) throw new TransferNotFoundException('Transfer not found');

    const reversalGroup = `reversal:${transferGroup}`;
    const existing = await this.movementRepository.findByTransferGroup(reversalGroup, user);
    if (existing.length) throw new TransferAlreadyReversedException('Transfer already reversed');

    const flip = (t: MovementType) =>
      t === MovementType.TRANSFER_OUT ? MovementType.TRANSFER_IN : MovementType.TRANSFER_OUT;

    const compensations = legs.map((leg) =>
      Movement.create({
        date: new Date(),
        type: flip(leg.type),
        description: `Reversal of transfer ${transferGroup}`,
        amount: leg.amount,
        currency: leg.currency,
        accountId: leg.accountId,
        user,
        transferGroup: reversalGroup,
        source: MovementSource.MANUAL,
      } as Movement),
    );

    const [out, into] = await this.movementRepository.saveAll(compensations);
    return {
      originalTransferGroup: transferGroup,
      reversalTransferGroup: reversalGroup,
      fromMovementId: out.id,
      toMovementId: into.id,
    };
  }
}
```
Excepciones → 404 y 409 respectivamente.

**Step 4:**
```bash
npx jest apps/finances/src/transfer/application/usecases/reverse-transfer.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 17: Controller `POST /transfers/:transferGroup/reversal` + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/transfer/infrastructure/adapters/http/transfer.controller.ts`
- Modificar: `apps/finances/src/transfer/transfer.module.ts` (agregar `ReverseTransferUsecase`)

**Step 3: Implementar**
```typescript
@Post(':transferGroup/reversal')
async reverse(
  @CurrentUser() user: AuthenticatedUser,
  @Param('transferGroup') transferGroup: string,
): Promise<TransferReversalOutputDto> {
  return this.reverseTransferUsecase.execute(transferGroup, user.id);
}
```

**Step 4:** `npx jest apps/finances/src/transfer/ --no-coverage` → PASS.

---

## LOTE 4 — AC-6: Reversa de movimiento de webhook

### Tarea 18: DTO `MovementReversalOutputDto` [X]

**Archivos:**
- Crear: `apps/finances/src/webhook/application/dto/movement-reversal-output.dto.ts`
- Modificar barrel de dto.
```typescript
export class MovementReversalOutputDto {
  externalReference: string;
  originalMovementId: number;
  reversalMovementId: number;
}
```

### Tarea 19: Usecase `ReverseWebhookTransactionUsecase` [X]

**Archivos:**
- Crear: `apps/finances/src/webhook/application/usecases/reverse-webhook-transaction.usecase.ts`
- Modificar barrel.
- Test: `.../reverse-webhook-transaction.usecase.spec.ts`

**Estrategia de idempotencia:** la reversa es un movimiento con
`externalReference = 'reversal:' + original.externalReference`. Un segundo llamado encuentra ese
movimiento y devuelve el mismo resultado (200 idempotente), sin duplicar.

**Step 1: Tests que fallan**
```typescript
it('404 si no existe movimiento con ese externalReference', async () => {
  movementRepo.findByExternalReference.mockResolvedValue(null);
  await expect(usecase.execute('ext-1')).rejects.toThrow(MovementNotFoundException);
});
it('crea un movimiento compensatorio con el tipo invertido', async () => {
  movementRepo.findByExternalReference
    .mockResolvedValueOnce({ id: 5, type: MovementType.EXPENSE, amount: 30, currency: 'COP', categoryId: 3, accountId: 2, user: 7, externalReference: 'ext-1' })
    .mockResolvedValueOnce(null); // no hay reversa aún
  movementRepo.save.mockResolvedValue({ id: 9 });
  const result = await usecase.execute('ext-1');
  expect(result).toEqual({ externalReference: 'ext-1', originalMovementId: 5, reversalMovementId: 9 });
});
it('es idempotente: segunda llamada no duplica', async () => {
  movementRepo.findByExternalReference
    .mockResolvedValueOnce({ id: 5, externalReference: 'ext-1' })
    .mockResolvedValueOnce({ id: 9, externalReference: 'reversal:ext-1' });
  const result = await usecase.execute('ext-1');
  expect(result.reversalMovementId).toBe(9);
  expect(movementRepo.save).not.toHaveBeenCalled();
});
```

**Step 3: Implementar**
```typescript
@Injectable()
export class ReverseWebhookTransactionUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(externalReference: string): Promise<MovementReversalOutputDto> {
    const original = await this.movementRepository.findByExternalReference(externalReference);
    if (!original) throw new MovementNotFoundException('Transaction not found');

    const reversalRef = `reversal:${externalReference}`;
    const existing = await this.movementRepository.findByExternalReference(reversalRef);
    if (existing) {
      return { externalReference, originalMovementId: original.id, reversalMovementId: existing.id };
    }

    const flip = (t: MovementType) => (t === MovementType.EXPENSE ? MovementType.INCOME : MovementType.EXPENSE);
    const compensation = Movement.create({
      date: new Date(),
      type: flip(original.type),
      description: `Reversal of ${externalReference}`,
      amount: original.amount,
      currency: original.currency,
      categoryId: original.categoryId,
      subcategoryId: original.subcategoryId,
      accountId: original.accountId,
      user: original.user,
      source: MovementSource.WEBHOOK,
      externalReference: reversalRef,
    } as Movement);

    const saved = await this.movementRepository.save(compensation);
    return { externalReference, originalMovementId: original.id, reversalMovementId: saved.id };
  }
}
```

**Step 4:**
```bash
npx jest apps/finances/src/webhook/application/usecases/reverse-webhook-transaction.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 20: Controller `POST /webhooks/transactions/:externalReference/reversal` + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/webhook/infrastructure/adapters/http/webhook.controller.ts`
- Modificar: `apps/finances/src/webhook/webhook.module.ts`

**Step 3: Implementar** (mantiene `@Public()` + `WebhookApiKeyGuard` del controller)
```typescript
@Post('transactions/:externalReference/reversal')
async reverse(
  @Param('externalReference') externalReference: string,
): Promise<MovementReversalOutputDto> {
  return this.reverseWebhookTransactionUsecase.execute(externalReference);
}
```

**Step 4:** `npx jest apps/finances/src/webhook/ --no-coverage` → PASS.

---

## LOTE 5 — AC-1: Notificación de umbral entregable (PGMQ) + columna en budgets

### Tarea 21: Entidad + migración `budgets.notified_threshold` [X]

**Archivos:**
- Modificar: `apps/finances/src/budget/infrastructure/adapters/persistence/typeorm/budget/typeorm-budget.entity.ts`
- Modificar: `apps/finances/src/budget/domain/budget/budget.entity.ts` (agregar `notifiedThreshold`)
- Modificar: mapper de budget.
- Crear: `apps/finances/src/database/migrations/1784073600017-AddBudgetNotifiedThreshold.ts`

**Fuente de verdad:** `docs/data-model.md`.

**Step 1: Entidad TypeORM**
```typescript
@Column({ name: 'notified_threshold', type: 'varchar', nullable: true })
notifiedThreshold: BudgetThreshold | null;
```
(Importar `BudgetThreshold` desde `budget.constants`.)

**Step 2: Migración**
```typescript
export class AddBudgetNotifiedThreshold1784073600017 implements MigrationInterface {
  name = 'AddBudgetNotifiedThreshold1784073600017';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "budgets" ADD "notified_threshold" character varying`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "budgets" DROP COLUMN "notified_threshold"`);
  }
}
```

**Step 3: Correr migración**
```bash
TS_NODE_PROJECT=apps/finances/tsconfig.app.json NODE_OPTIONS="-r tsconfig-paths/register" \
  npx typeorm-ts-node-commonjs migration:run -d apps/finances/src/database/data-source.ts
```
Esperado: `Migration AddBudgetNotifiedThreshold1784073600017 has been executed successfully`.

### Tarea 22: Puerto de mensajería `BudgetNotificationPublisher` [X]

**Archivos:**
- Crear: `apps/finances/src/budget/domain/budget/budget-notification.publisher.ts`

```typescript
import { BudgetThresholdExceededPayload } from '../../application/budget.constants';

/** Publica la alerta de umbral en un canal que un consumidor externo lee. */
export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
```

### Tarea 23: Adapter PGMQ `PgmqBudgetNotificationPublisher` ⚠️ INFRA NUEVA [X]

**Archivos:**
- Crear: `apps/finances/src/budget/infrastructure/adapters/messaging/pgmq-budget-notification.publisher.ts`
- Modificar: `apps/finances/src/env.ts` (agregar `PGMQ_QUEUE` / config de cola)

> ⚠️ **Bloqueante de infraestructura:** requiere la extensión **PGMQ** en Postgres
> (`CREATE EXTENSION pgmq;`) y elegir el cliente (llamar `pgmq.send(queue, jsonb)` vía una
> query de TypeORM sobre la conexión existente). Definir el nombre de cola (`budget.threshold`)
> y el shape del mensaje (= `BudgetThresholdExceededPayload`). Añadir la extensión al
> `docker-compose.yml` y una migración que cree la cola.

**Implementación (envío vía SQL sobre la conexión existente):**
```typescript
@Injectable()
export class PgmqBudgetNotificationPublisher implements BudgetNotificationPublisher {
  constructor(private readonly dataSource: DataSource, private readonly config: ConfigService) {}
  async publish(payload: BudgetThresholdExceededPayload): Promise<void> {
    const queue = this.config.get(ENV.PGMQ_QUEUE);
    await this.dataSource.query(`SELECT pgmq.send($1, $2)`, [queue, JSON.stringify(payload)]);
  }
}
```
**Test:** mockear `dataSource.query` y verificar que se llama con la cola y el payload serializado.

### Tarea 24: `MovementSavedEventHandler` — notificar una vez por umbral y período [X]

**Archivos:**
- Modificar: `apps/finances/src/budget/infrastructure/adapters/events/movement-saved.event-handler.ts`
- Test: `.../movement-saved.event-handler.spec.ts`

**Step 1: Tests que fallan (AC-1 idempotencia)**
```typescript
it('emite al cruzar 80% la primera vez y persiste notifiedThreshold=WARNING', async () => { ... });
it('NO reemite si un segundo movimiento mantiene el presupuesto sobre 80% ya notificado', async () => { ... });
it('emite EXCEEDED al cruzar 100% aunque WARNING ya se notificó', async () => { ... });
```

**Step 3: Implementar** — tras calcular `threshold`, comparar con `budget.notifiedThreshold`:
```typescript
if (!threshold) continue;
// jerarquía: EXCEEDED > WARNING. Solo notificar si el umbral alcanzado supera al ya notificado.
const rank = { [BudgetThreshold.WARNING]: 1, [BudgetThreshold.EXCEEDED]: 2 };
const alreadyRank = budget.notifiedThreshold ? rank[budget.notifiedThreshold] : 0;
if (rank[threshold] <= alreadyRank) continue;

budget.notifiedThreshold = threshold;
await this.budgetRepository.save(budget);
this.eventEmitter.emit(BudgetThresholdExceeded, { budgetId: budget.id, percentage, threshold, user: budget.user });
```
(El handler sigue emitiendo el evento interno; el sink de Tarea 25 lo publica en PGMQ.)

**Step 4:**
```bash
npx jest apps/finances/src/budget/infrastructure/adapters/events/movement-saved.event-handler.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 25: Reemplazar el placeholder por el publisher PGMQ + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/budget/infrastructure/adapters/events/budget-threshold-exceeded.event-handler.ts`
- Modificar: `apps/finances/src/budget/budget.module.ts` (proveer `BudgetNotificationPublisher→PgmqBudgetNotificationPublisher`)

**Step 3: Implementar** — el handler inyecta `BudgetNotificationPublisher` y llama `publish(payload)` en vez de `Logger.warn`. Registrar el binding en el módulo.

**Step 4:** `npx jest apps/finances/src/budget/ --no-coverage` → PASS.

---

## LOTE 6 — AC-2: Conversión de moneda ⚠️ DEPENDE DE `exchanges` + claim JWT

> ⚠️ Este lote NO es ejecutable de punta a punta hasta que: (a) `apps/exchanges` esté reactivado
> y exponga un endpoint de tasa por fecha, y (b) `users` emita el claim `presentationCurrency`
> en el JWT. Las tareas 27, 29, 30 se pueden implementar y testear con el puerto mockeado; las
> 26 y 28 quedan bloqueadas por trabajo externo.

### Tarea 26: `presentationCurrency` en `AuthenticatedUser` ⚠️ CROSS-LIB / EXTERNO [X]

**Archivos:**
- Modificar: `libs/shared/src/auth/authenticated-user.type.ts`
```typescript
export interface AuthenticatedUser {
  id: number;
  name: string;
  lastName: string;
  email: string;
  auth0Id: string;
  presentationCurrency?: string; // AC-2: claim emitido por users
}
```
> ⚠️ Externo: requiere que `users` agregue el claim al token y que el guard de `@shared` lo mapee
> desde el JWT. Coordinar con el micro `users`. Hasta entonces, `presentationCurrency` puede venir
> `undefined` → fallback a la moneda de la primera cuenta o a un default configurable.

### Tarea 27: Puerto `ExchangeRateProvider` [X]

**Archivos:**
- Crear: `apps/finances/src/exchange/domain/exchange-rate.provider.ts`
```typescript
/** Tasa de conversión entre dos monedas a una fecha (carry-forward si no hay exacta). */
export abstract class ExchangeRateProvider {
  abstract getRate(from: string, to: string, date: Date): Promise<number>;
}
```
Excepción `ExchangeRateUnavailableException` (→ 422) si no hay ninguna tasa histórica.

### Tarea 28: Adapter HTTP `HttpExchangeRateProvider` ⚠️ EXTERNO [X]

**Archivos:**
- Crear: `apps/finances/src/exchange/infrastructure/http-exchange-rate.provider.ts`
- Modificar: `apps/finances/src/env.ts` (`EXCHANGES_API_URL`)

> ⚠️ Bloqueante: el contrato HTTP de `exchanges` (path, params, shape de respuesta, política
> carry-forward) no existe todavía. Implementar contra ese contrato una vez definido. Mientras
> tanto, un stub que lea de una tabla local o devuelva 1 permite testear el resto del lote.

### Tarea 29: Transferencia cross-currency [X]

**Archivos:**
- Modificar: `apps/finances/src/transfer/application/usecases/create-transfer.usecase.ts`
- Modificar: `apps/finances/src/transfer/application/dto/transfer-output.dto.ts` (agregar `toAmount`, `toCurrency`, `exchangeRate`)
- Modificar: `apps/finances/src/transfer/transfer.module.ts` (inyectar `ExchangeRateProvider`)
- Test: `create-transfer.usecase.spec.ts`

**Step 1: Tests que fallan**
```typescript
it('misma moneda: rate=1, toAmount=amount', async () => { ... expect(result.exchangeRate).toBe(1); });
it('distinta moneda: toAmount = amount * rate del provider', async () => {
  exchangeProvider.getRate.mockResolvedValue(0.00025);
  const result = await usecase.execute({ from:1, to:2, amount:100000, currency:'COP', date }, 7);
  expect(result.toCurrency).toBe('USD');
  expect(result.toAmount).toBeCloseTo(25);
});
it('422 si no hay tasa histórica', async () => {
  exchangeProvider.getRate.mockRejectedValue(new ExchangeRateUnavailableException('x'));
  await expect(usecase.execute({ from:1, to:2, amount:100, currency:'COP', date }, 7)).rejects.toThrow(ExchangeRateUnavailableException);
});
```

**Step 3: Implementar** — reemplazar el bloque que lanza `TransferCurrencyMismatchException` por:
```typescript
let exchangeRate = 1;
let toAmount = input.amount;
if (from.currency !== to.currency) {
  exchangeRate = await this.exchangeRateProvider.getRate(from.currency, to.currency, input.date);
  toAmount = Math.round(input.amount * exchangeRate * 100) / 100;
}
```
Las patas: `TRANSFER_OUT` con `amount=input.amount, currency=from.currency`; `TRANSFER_IN` con `amount=toAmount, currency=to.currency`. Output agrega `toAmount, toCurrency: to.currency, exchangeRate`.
> `TransferCurrencyMismatchException` se retira del camino (o se conserva solo si el provider no está disponible).

**Step 4:**
```bash
npx jest apps/finances/src/transfer/application/usecases/create-transfer.usecase.spec.ts --no-coverage
```
Esperado: PASS.

### Tarea 30: Balance consolidado en moneda de presentación [X]

**Archivos:**
- Crear: `apps/finances/src/summary/application/dto/consolidated-balance-output.dto.ts`
- Modificar: `GetBalanceUsecase` (summary) para consolidar por `presentationCurrency`
- Modificar: `SummaryRepository` / adapter si hace falta saldo por cuenta y moneda
- Test: usecase spec

**Step 1: Tests que fallan** — dado saldos por cuenta en COP y USD y `presentationCurrency=USD`, convierte cada uno con `ExchangeRateProvider` y suma en USD; arma `accounts[]` con `balance` y `balanceInPresentationCurrency`.

**Step 3: Implementar** `ConsolidatedBalanceOutputDto` (según `api.yaml`: `presentationCurrency, total, incomes, expenses, accounts[]`). El usecase toma `user` + `presentationCurrency` (del `AuthenticatedUser`), obtiene saldos por cuenta, convierte y consolida.

**Step 4:** `npx jest apps/finances/src/summary/ --no-coverage` → PASS.

### Tarea 31: Controller `GET /summary/balance` (output consolidado) + registro [X]

**Archivos:**
- Modificar: `apps/finances/src/summary/infrastructure/adapters/http/summary.controller.ts`
- Modificar: `apps/finances/src/summary/summary.module.ts` (inyectar `ExchangeRateProvider`)

**Step 3: Implementar** — el endpoint pasa `user.presentationCurrency` al usecase y devuelve `ConsolidatedBalanceOutputDto`.
> ⚠️ Cambia el shape de respuesta actual de `Balance` — coordinar con el front (documentado en `api.yaml`).

**Step 4:** `npx jest apps/finances/src/summary/ --no-coverage` → PASS.

---

## Tarea Final: Suite completa del microservicio

```bash
npx nx test finances
```
Esperado: PASS — todos los tests de `finances` en verde. Si algún lote quedó bloqueado por trabajo
externo (Tareas 23, 26, 28), sus tests corren contra el puerto mockeado; la integración real se
valida cuando la infra/otros micros estén listos.

---

## Notas de ejecución para `/build`

- **Ejecutá por lotes.** Lotes 1–4 son autocontenidos y deberían quedar en verde sin dependencias externas. Frená y validá antes de Lotes 5–6.
- **Lote 5 (AC-1)** introduce infraestructura (PGMQ): la extensión de Postgres y la cola son prerequisito de la integración real, aunque el usecase y la idempotencia se testean sin ella.
- **Lote 6 (AC-2)** depende de `exchanges` reactivado y del claim en el JWT (`users`/`@shared`): implementá contra `ExchangeRateProvider` mockeado; marcá 26 y 28 como bloqueadas hasta el trabajo externo.
- Excepciones de dominio nuevas deben mapear a su status HTTP (422/404/409) siguiendo el patrón del commit `893a1ff`.
