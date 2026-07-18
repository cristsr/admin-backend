# Modelado de datos: sm-0001

> Generado por /design. Consumido por /plan para la tarea de entidad + migración.

El único cambio de esquema en `finances` es una columna sobre `budgets` (AC-1). El
resto de los ACs reutiliza tablas existentes:

- **AC-3 saldo:** cálculo on-the-fly (`SUM`), sin columna nueva.
- **AC-4/AC-5/AC-6 ediciones y reversas:** reutilizan `movements` (incluido `transfer_group`, migración 15) y `scheduled`; las reversas son filas `movements` nuevas.
- **AC-2 tasas:** viven en `exchanges` (otro microservicio, fuera de este modelo). La moneda de presentación viaja en el JWT (cambio en `@shared`/`users`, no en el esquema de `finances`).

## Budget (tabla existente `budgets` — se agrega una columna)

Estado hasta qué umbral se notificó en el período vigente del presupuesto. Enum-like
almacenado como **varchar** (convención no-db-enums): los valores permitidos
(`WARNING`, `EXCEEDED`) viven en la capa de aplicación (`BudgetThreshold`). `null`
significa que aún no se notificó ningún umbral en este período. Al renovar un
presupuesto repetible, el budget nuevo nace con `null`.

### Entidad TypeORM (fragmento agregado a `TypeOrmBudgetEntity`)

```typescript
// apps/finances/src/budget/infrastructure/adapters/persistence/typeorm/budget/typeorm-budget.entity.ts
@Column({ name: 'notified_threshold', type: 'varchar', nullable: true })
notifiedThreshold: BudgetThreshold | null;
```

### Migración SQL

```sql
-- up
ALTER TABLE "budgets" ADD "notified_threshold" character varying;

-- down
ALTER TABLE "budgets" DROP COLUMN "notified_threshold";
```

> Nombre de migración siguiente en la secuencia: `1784073600017-AddBudgetNotifiedThreshold`.
> Sin DEFAULT: una fila sin notificación es `NULL`, no un string vacío.
