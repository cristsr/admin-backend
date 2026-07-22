# Modelado de datos: sm-0003

> Generado por /design. Consumido por /plan para las tareas de entidad + migración.
> Convenciones del repo: `BaseEntity` aporta `id` (serial), `created_at`,
> `updated_at`, `deleted_at` (timestamptz, soft-delete). Enum-like como `varchar`,
> nunca enum de Postgres. Columnas snake_case, tablas en plural. Migraciones TypeORM
> con SQL crudo (`1784073600020+`).

---

## Account (tabla existente — ALTER)

Se agrega la política de saldo negativo por cuenta (AC-1). El resto de la tabla no cambia.

### Cambio de entidad TypeORM

```typescript
// apps/finances/src/account/infrastructure/adapters/persistence/typeorm/account/typeorm-account.entity.ts
@Column({ name: 'allow_negative_balance', type: 'boolean', default: false })
allowNegativeBalance: boolean;
```

También agregar `allowNegativeBalance: boolean` al dominio (`account.entity.ts`),
al `AccountInputDto`/`AccountOutputDto` y a los mappers dominio↔TypeORM.

### Migración SQL

```sql
-- up
ALTER TABLE "accounts"
  ADD "allow_negative_balance" boolean NOT NULL DEFAULT false;

-- down
ALTER TABLE "accounts" DROP COLUMN "allow_negative_balance";
```

---

## Category (tabla existente — ALTER + seed)

Se agrega el flag de categoría sistémica y se siembra la categoría por defecto
"Sin categorizar" (AC-4).

### Cambio de entidad TypeORM

```typescript
// apps/finances/src/category/infrastructure/.../typeorm-category.entity.ts
@Column({ type: 'boolean', default: false })
system: boolean;
```

Agregar `system: boolean` al dominio `category.entity.ts` y a su mapper/DTO.
La categoría con `system = true` no puede eliminarse desde la API de categorías.

### Migración SQL

```sql
-- up
ALTER TABLE "categories"
  ADD "system" boolean NOT NULL DEFAULT false;

INSERT INTO "categories" ("name", "icon", "color", "system", "created_at")
VALUES ('Sin categorizar', 'help-circle', '#9E9E9E', true, NOW());

-- down
DELETE FROM "categories" WHERE "system" = true AND "name" = 'Sin categorizar';
ALTER TABLE "categories" DROP COLUMN "system";
```

---

## OutboxEvent (tabla nueva — AC-2)

Almacena cada evento de dominio en la misma transacción que el cambio que lo origina.
El relay (cron) la relee y entrega. No lleva `user` (tabla de sistema; el `user` viaja
en el payload). Estados: `PENDING` → `DELIVERED` | `FAILED`.

### Entidad TypeORM

```typescript
// apps/finances/src/outbox/infrastructure/.../typeorm-outbox-event.entity.ts
@Entity('outbox_events')
export class TypeOrmOutboxEventEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string; // OutboxStatus enum-like en la capa app: PENDING | DELIVERED | FAILED

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string;

  @Column({
    name: 'available_at',
    type: 'timestamp with time zone',
    default: () => 'NOW()',
  })
  availableAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({
    name: 'processed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  processedAt: Date;
}
```

### Migración SQL

```sql
-- up
CREATE TABLE "outbox_events" (
  "id"           SERIAL PRIMARY KEY,
  "event_type"   varchar NOT NULL,
  "payload"      jsonb NOT NULL,
  "status"       varchar NOT NULL DEFAULT 'PENDING',
  "attempts"     integer NOT NULL DEFAULT 0,
  "last_error"   text,
  "available_at" timestamptz NOT NULL DEFAULT NOW(),
  "created_at"   timestamptz NOT NULL DEFAULT NOW(),
  "processed_at" timestamptz
);
-- Índice para el polling del relay (pendientes disponibles)
CREATE INDEX "idx_outbox_events_pending"
  ON "outbox_events" ("status", "available_at");

-- down
DROP INDEX "idx_outbox_events_pending";
DROP TABLE "outbox_events";
```

> El relay selecciona con `... WHERE status IN ('PENDING','FAILED') AND available_at <= NOW()
ORDER BY id FOR UPDATE SKIP LOCKED LIMIT :batch` para tolerar concurrencia y reintentos con backoff.

---

## IdempotencyKey (tabla nueva — AC-3)

Registra cada `Idempotency-Key` por usuario, el hash del cuerpo y la respuesta
almacenada para reproducirla. Retención 24h (`expires_at`), purga por cron.

### Entidad TypeORM

```typescript
// apps/finances/src/idempotency/infrastructure/.../typeorm-idempotency-key.entity.ts
@Entity('idempotency_keys')
@Unique(['userId', 'idempotencyKey'])
export class TypeOrmIdempotencyKeyEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'idempotency_key', type: 'varchar' })
  idempotencyKey: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  endpoint: string; // p. ej. 'POST /movements'

  @Column({ name: 'request_hash', type: 'varchar' })
  requestHash: string; // SHA-256 hex del body canónico

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string; // PENDING | COMPLETED

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt: Date;
}
```

### Migración SQL

```sql
-- up
CREATE TABLE "idempotency_keys" (
  "id"              SERIAL PRIMARY KEY,
  "idempotency_key" varchar NOT NULL,
  "user_id"         integer NOT NULL,
  "endpoint"        varchar NOT NULL,
  "request_hash"    varchar NOT NULL,
  "status"          varchar NOT NULL DEFAULT 'PENDING',
  "response_status" integer,
  "response_body"   jsonb,
  "created_at"      timestamptz NOT NULL DEFAULT NOW(),
  "expires_at"      timestamptz NOT NULL
);
CREATE UNIQUE INDEX "uq_idempotency_user_key"
  ON "idempotency_keys" ("user_id", "idempotency_key");
CREATE INDEX "idx_idempotency_expires_at"
  ON "idempotency_keys" ("expires_at");

-- down
DROP INDEX "idx_idempotency_expires_at";
DROP INDEX "uq_idempotency_user_key";
DROP TABLE "idempotency_keys";
```

> Flujo: se inserta la fila `PENDING` primero (el índice único bloquea duplicados
> concurrentes → 409 en curso). Al completar, `UPDATE ... status='COMPLETED',
response_status, response_body`. Misma clave + `request_hash` distinto → 422.

---

## CategorizationRule (tabla nueva — AC-4)

Reglas por usuario que mapean un patrón (substring case-insensitive de merchant o
descripción) a una categoría/subcategoría, con prioridad para el desempate.

### Entidad TypeORM

```typescript
// apps/finances/src/categorization-rule/infrastructure/.../typeorm-categorization-rule.entity.ts
@Entity('categorization_rules')
export class TypeOrmCategorizationRuleEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'varchar' })
  pattern: string;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  @Column({ name: 'subcategory_id', type: 'int', nullable: true })
  subcategoryId: number;

  @Column({ type: 'int', default: 0 })
  priority: number;
}
```

### Migración SQL

```sql
-- up
CREATE TABLE "categorization_rules" (
  "id"             SERIAL PRIMARY KEY,
  "user_id"        integer NOT NULL,
  "pattern"        varchar NOT NULL,
  "category_id"    integer NOT NULL,
  "subcategory_id" integer,
  "priority"       integer NOT NULL DEFAULT 0,
  "created_at"     timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"     timestamptz,
  "deleted_at"     timestamptz
);
CREATE INDEX "idx_categorization_rules_user_priority"
  ON "categorization_rules" ("user_id", "priority");

-- down
DROP INDEX "idx_categorization_rules_user_priority";
DROP TABLE "categorization_rules";
```

---

## Nota transversal para /plan (AC-5)

No hay tabla nueva para AC-5, pero el cálculo de saldo por SQL crudo en
`typeorm-account.repository.ts` (`movementBalance`, `movementBalancesByUser`,
`hasMovements`) **debe filtrar `deleted_at IS NULL`** para que los movimientos
soft-deleted por el archivado en cascada dejen de contar. Verificar/ajustar esas
queries como parte de AC-5.
