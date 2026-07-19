# context: sm-0002

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** usuario del backend de finanzas
**Quiero** reportes y analítica más allá del `summary` actual (serie temporal de flujo, gasto
por categoría con comparativa, proyección de cierre, reporte por comercio y por método de pago,
export a CSV/XLSX)
**Para** entender mi flujo de dinero en el tiempo y anticipar el cierre del período

## Microservicios afectados

- `finances` (app Nx única; un solo repo mono-repo). La historia crea un **módulo nuevo
  `reports`** que **lee** de `movement`, `category`/`subcategory`, `account` y `scheduled`, y
  reusa patrones de `summary` (agregación) y `budget` (cola pgmq).

**Estado git:** rama `feat/core` (no `master`), con cambios sin commitear. Es la rama de
trabajo activa de la feature; el scan leyó el código tal como está (correcto para esta historia).

---

## finances

### Módulo a crear
`apps/finances/src/reports/` — hexagonal (`domain/` + `application/` + `infrastructure/adapters/`),
**no existe todavía** (greenfield). Registrar en:
`apps/finances/src/app.module.ts` → array `imports` (junto a `SummaryModule`, `BudgetModule`, …).

### Fuente de datos principal — entidad Movement (solo lectura)

**Dominio:** `apps/finances/src/movement/domain/movement/movement.entity.ts`
**TypeORM:** `apps/finances/src/movement/infrastructure/adapters/persistence/typeorm/movement/typeorm-movement.entity.ts` (tabla `movements`)

Campos relevantes para reportes:
- `date`: `Date` — columna `date` (`@DateColumn`)
- `type`: `MovementType` — `varchar` (`INCOME`/`EXPENSE`/`TRANSFER_IN`/`TRANSFER_OUT`)
- `amount`: `number` — `@MoneyColumn` → `numeric(14,2)`; **el driver lo devuelve como string**, mapear con `Number(...)`
- `currency`: `string` — `varchar(3)`
- `merchant`: `string?` — `nullable` (AC-4; nulos → grupo "Sin comercio")
- `paymentMethod`: `PaymentMethod?` — columna `payment_method` `varchar` nullable (AC-5; nulos → "Sin método")
- `categoryId`: `number` — relación `category_id` (`@ManyToOne … onDelete SET NULL`)
- `subcategoryId`: `number?` — relación `subcategory_id` (`@ManyToOne … onDelete SET NULL`)
- `accountId`: `number` — relación `account_id` (`@ManyToOne … eager`)
- `user`: `number` — columna `user_id` (scope multitenant)
- `deletedAt`: `Date` — soft-delete vía `BaseEntity`; **filtrar siempre `deleted_at IS NULL`**
- `transferGroup`, `source`, `notes`, `description`, campos `invoice*` — disponibles para el export

### Enums / constantes de dominio (reutilizar, NO redefinir)

**Archivo:** `apps/finances/src/movement/domain/movement/movement.types.ts`
- `MovementType` (enum): `INCOME | EXPENSE | TRANSFER_IN | TRANSFER_OUT`
- `reportableMovementTypes = [INCOME, EXPENSE]` — **clave para excluir transferencias** en todos los agregados
- `PaymentMethod` (enum): `CASH | DEBIT | CREDIT | TRANSFER | OTHER`
- `MovementSource` (enum): `MANUAL | WEBHOOK | SCHEDULED`

**Frequency (AC-3 proyección):** `apps/finances/src/scheduled/domain/scheduled/frequency.enum.ts`
- `Frequency`: `ONCE | DAILY | WEEKLY | MONTHLY | YEARLY`

### Patrón de agregación a espejar — SummaryRepository

**Puerto:** `apps/finances/src/summary/domain/summary/summary.repository.ts`
```typescript
export abstract class SummaryRepository {
  abstract balance(filter: BalanceQuery): Promise<Nullable<Balance>>;
  abstract expenses(filter: ExpenseQuery): Promise<Expense[]>;
  abstract lastMovements(filter: LastMovementsQuery): Promise<Movement[]>;
}
```
**Impl:** `apps/finances/src/summary/infrastructure/adapters/persistence/typeorm/summary/typeorm-summary.repository.ts`
- Usa `QueryBuilder` con SQL crudo + `getRawOne`/`getRawMany`; agrega con `SUM(CASE WHEN type = ... )`, `groupBy`, `orderBy`.
- Convierte `numeric` (string) → `Number(...)` en el map de salida.
- Excluye transferencias vía `type = 'EXPENSE'` / `type IN ('INCOME','TRANSFER_IN')` según el cálculo.
- **⚠️ Está scopeado por `account` (una sola cuenta).** Los reportes de sm-0002 son **por usuario (todas las cuentas)** → el nuevo repositorio debe scopear por `user_id` y dejar el filtro de cuenta opcional.
- **Tipos:** `apps/finances/src/summary/domain/summary/summary.types.ts` (`Balance`, `Expense`, `*Query`) — modelo a imitar para los tipos de salida de reports.

### Patrón de cola pgmq a espejar — export asíncrono (AC-6)

**Puerto (abstract class en dominio):** `apps/finances/src/budget/domain/budget/budget-notification.publisher.ts`
```typescript
export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
```
**Impl pgmq:** `apps/finances/src/budget/infrastructure/adapters/messaging/pgmq-budget-notification.publisher.ts`
- `await this.dataSource.query('SELECT pgmq.send($1, $2)', [queue, JSON.stringify(payload)])`
- Nombre de cola desde config: `this.config.get(ENV.PGMQ_BUDGET_QUEUE) ?? 'budget_threshold'`
- Traga el error con `Logger` para no romper el flujo principal.
- **Requiere** la extensión `pgmq` en Postgres y la cola creada (`SELECT pgmq.create('<queue>')`).
- Para reports: crear un puerto análogo (p.ej. `ReportExportPublisher`) + impl pgmq, con su propia
  cola y su propia ENV var (patrón `ENV.PGMQ_*`).

### Convenciones a seguir (confirmadas en el código)

- **DTOs** en `application/dto/`, sufijos `*-filter.dto.ts` / `*-input.dto.ts` / `*-output.dto.ts`.
  Ref filtro reutilizable: `apps/finances/src/movement/application/dto/movement-filter.dto.ts`
  (`startDate`, `endDate`, `account?`, `category?`, `order?`, `type?: MovementType[]`, `limit?`, `offset?`).
  **Nota:** el código usa `startDate/endDate`; la historia habla de `from/to` → reconciliar naming en /design.
- **Usecase** (uno por acción): `apps/finances/src/summary/application/usecases/get-expenses.usecase.ts`
  ```typescript
  @Injectable()
  export class GetExpensesUsecase {
    constructor(private readonly summaryRepository: SummaryRepository) {}
    async execute(filter: ExpenseFilterDto, user: number): Promise<Expense[]> {
      return this.summaryRepository.expenses({ ...filter, user });
    }
  }
  ```
- **Controller HTTP:** `apps/finances/src/summary/infrastructure/adapters/http/summary.controller.ts`
  `@Controller('summary')`, `@Get('...')`, `@CurrentUser() user: AuthenticatedUser` (de `@shared`),
  `@Query() filter: <FilterDto>` → `usecase.execute(filter, user.id)`.
- **Wiring del módulo:** `apps/finances/src/summary/summary.module.ts` / `budget.module.ts`
  - `providers: [{ provide: <PuertoAbstractClass>, useClass: <TypeOrmImpl> }, ...usecases]`
  - Puerto de cola: `{ provide: <Publisher>, useClass: Pgmq<Publisher> }`
  - `imports: [TypeOrmModule.forFeature([<Entities>]), <OtrosModulos>]`

### Modelo de categoría/subcategoría (AC-2)

- **Category:** `apps/finances/src/category/domain/category/category.entity.ts` → `{ id, name, icon, color, subcategories? }`
- **Subcategory:** `apps/finances/src/category/domain/subcategory/subcategory.entity.ts` → `{ id, name, categoryId }`
- Taxonomía **global** (sin scope de usuario). Jerarquía fija de 2 niveles. `Movement` referencia
  `categoryId` + `subcategoryId?` → el anidado categoría→subcategoría de AC-2 sale de agrupar por ambos.

### Modelo scheduled (AC-3 proyección)

**Entidad:** `apps/finances/src/scheduled/domain/scheduled/scheduled.entity.ts`
- `{ date (próxima ocurrencia), type, amount, currency, categoryId, subcategoryId, accountId, user, frequency }`
- `advance()` calcula la siguiente fecha con **luxon** según `frequency`; `recurs()` = no ONCE.
- **⚠️** Solo se persiste la **próxima** ocurrencia (`date`). Para proyectar todas las ocurrencias
  dentro de `[hoy, to]` (AC-3) hay que **simular `advance()` en memoria** repetidamente; no existe
  una consulta "expandir scheduled entre fechas" (el cron `scheduled.scheduler.ts` solo materializa
  las vencidas de a una).

### Identidad del usuario autenticado

**Archivo:** `libs/shared/src/auth/authenticated-user.type.ts`
- `AuthenticatedUser { id, name, lastName, email, auth0Id, presentationCurrency? }`
- El scope de todos los reportes es `user.id`. `presentationCurrency` es opcional.

### Documentación disponible
- Índice del proyecto: `RESUMEN_EJECUTIVO.md` (visión, módulos, migraciones, endpoints).
- **Sin** carpeta `docs/services/finances/` (no hay docs por-componente; el RESUMEN cumple ese rol).

---

## Gaps detectados / decisiones para /design

1. **Scope usuario vs cuenta:** el patrón de `summary` agrega por `account` único; los reportes de
   esta historia son por **usuario (todas sus cuentas)**. El nuevo `ReportsRepository` debe scopear
   por `user_id` con filtro de cuenta opcional. No hay hoy un agregado user-wide para reutilizar tal cual.

2. **`exceljs` no está instalado aún** (AC-6 XLSX): no aparece como dependencia en el código
   escaneado. Hay que agregarlo a `package.json` (`npm i exceljs --legacy-peer-deps`). CSV puede
   serializarse a mano sin librería.

3. **Infra del export asíncrono (AC-6) — el hueco más grande:** el patrón pgmq de `budget` solo
   *publica* en la cola; para el export falta definir (no existe en el código):
   - el **consumidor/worker** que toma el job y genera el archivo,
   - **dónde vive el archivo** generado y **cómo se descarga después** (endpoint de descarga +
     almacenamiento/estado del job). `/design` debe especificar este ciclo (encolar → generar →
     disponibilizar → descargar).
   - Crear la cola en Postgres (`SELECT pgmq.create('<report_export>')`) + nueva `ENV.PGMQ_*`.

4. **AC-3 proyección:** no hay lógica para expandir un `Scheduled` en sus ocurrencias futuras dentro
   de un rango; se resuelve simulando `advance()` en memoria. Definir en /design el algoritmo
   (iterar desde `date` aplicando `frequency` hasta superar `to`).

5. **Moneda — tensión con el supuesto de la historia:** la HU asume "una sola moneda por usuario"
   (conversión diferida a sm-0001), **pero ya existe capacidad de conversión** en el código:
   - Módulo `apps/finances/src/exchange/` (`domain/exchange-rate.provider.ts`,
     `providers/exchanges/exchange-rates.service.ts`, `infrastructure/local-exchange-rate.provider.ts`,
     `repositories/exchange.repository.ts`).
   - `GetConsolidatedBalanceUsecase` + `ConsolidatedBalanceFilterDto` en `summary` ya consolidan
     usando `user.presentationCurrency` + `ExchangeModule`.
   - **Decisión para /design:** mantener el supuesto de moneda única (totales simples) como dice la
     HU, o aprovechar `ExchangeModule`/`presentationCurrency` ya presentes. La HU manda salvo que se
     re-clarifique.

6. **Naming `from/to` vs `startDate/endDate`:** la HU usa `from/to`; los DTOs existentes usan
   `startDate/endDate`. Elegir uno en /design y ser consistente en los DTOs de reports.

7. **Módulo `reports` inexistente:** todo el árbol hexagonal (`domain/application/infrastructure`)
   se crea desde cero y se registra en `app.module.ts`.
