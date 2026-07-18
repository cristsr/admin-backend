# context: sm-0001

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** usuario del backend de finanzas (y los sistemas que lo consumen: front y la ingesta Rust)
**Quiero** que las funcionalidades que el código ya dejó insinuadas queden completas y usables end-to-end
**Para** no depender de que cada cliente recalcule, simule o parchee lo que el backend dejó sin cerrar

Historia transversal (Grupo A). Sus 6 ACs tocan casi todos los módulos de `finances`.

## Microservicios afectados

- **finances** (`apps/finances`) — único microservicio. Mono-repo Nx; los "componentes" son módulos internos.
- **users** (`apps/users`) — dependencia cruzada de solo lectura para AC-2 (preferencia de moneda de presentación del usuario, consumida vía `USERS_API_URL`).
- **exchanges** (`apps/exchanges`) — a reactivar como fuente de tasas de AC-2 (hoy huérfano y roto).

> Nota PHASE 2 (git, read-only): rama actual `feat/core` (no `master`), con cambios sin commitear.
> El scan leyó el código tal cual está — es la base correcta porque todo el trabajo de finanzas vive aquí.

---

## finances — mapa por AC

Raíz de módulos: `D:\Cristian\Nest\admin-back\apps\finances\src\`
Patrón hexagonal por módulo: `domain/` (entidad + puerto `abstract class`) · `application/` (dto, mappers, usecases) · `infrastructure/adapters/` (http, persistence/typeorm, schedulers, events).
Registro: cada `*.module.ts` se importa en `apps\finances\src\app.module.ts`.

### AC-1 — Canal de entrega de `BudgetThresholdExceeded` (módulo `budget`)

- **Cálculo del umbral (ya existe):** `budget\infrastructure\adapters\events\movement-saved.event-handler.ts`
  — escucha `MovementSaved`, hace `budgetRepository.findActiveMatching(...)` + `movementRepository.sumAmount({... type: EXPENSE})`, calcula `percentage` y emite `BudgetThresholdExceeded` con `EventEmitter2`.
- **Sink actual (a reemplazar):** `budget\infrastructure\adapters\events\budget-threshold-exceeded.event-handler.ts`
  — hoy solo `Logger.warn`. Es el placeholder del canal real.
- **Constantes/payload:** `budget\application\budget.constants.ts` — `BudgetThresholdExceeded` (event name), `BudgetThresholdExceededPayload { budgetId, percentage, threshold, user }`, `BudgetThreshold { WARNING=80, EXCEEDED=100 }`, `BUDGET_THRESHOLD_LIMITS`.
- **Providers:** `budget\budget.module.ts` — `BudgetRepository→TypeOrmBudgetRepository`, usecases, `BudgetScheduler`, `GenerateBudgetsEventHandler`, `MovementSavedEventHandler`, `BudgetThresholdExceededEventHandler`.
- **Decisión sm-0001:** publicar en **cola sobre PostgreSQL (postgresmq/PGMQ)**, consumida por un sistema externo; notificar **una vez por umbral y período**.
- **GAP:** no existe infraestructura de cola. Hoy todo es `EventEmitter2` in-process. Hay que introducir el adaptador de mensajería sobre Postgres y persistir el "ya notificado" por (budget, período, umbral) para la idempotencia.

### AC-2 — Conversión de moneda (módulos `summary`, `transfer`, nuevo puerto)

- **Campo `currency`:** en `account.entity.ts` (`currency: string`) y `movement.entity.ts` (`currency: string`). Sin lógica de conversión.
- **Rechazo cross-currency actual:** `transfer\application\usecases\create-transfer.usecase.ts` lanza `TransferCurrencyMismatchException` cuando `from.currency !== to.currency`.
- **Balance consolidado:** puerto `summary\domain\summary\summary.repository.ts` → `balance(filter): Promise<Nullable<Balance>>`. Hoy es mono-moneda.
- **Decisión sm-0001:** tasas desde `apps/exchanges` (reactivar), consumidas por un puerto nuevo `ExchangeRateProvider`; moneda de presentación = **preferencia por usuario** (vive en `users`, se lee vía `USERS_API_URL`); sin tasa para la fecha → **carry-forward** (la más cercana anterior).
- **GAP:** no existe el puerto `ExchangeRateProvider` ni adaptador. `apps/exchanges` está roto. La preferencia de moneda no existe hoy en `AuthenticatedUser` ni en el perfil consumido — hay que definir de dónde la lee `finances`.

### AC-3 — Saldo vivo por cuenta (módulo `account`, + `movement`)

- **Entidad:** `account\domain\account\account.entity.ts` — `id, name, initialBalance: number, currency, user, timestamps`. No guarda saldo vivo.
- **Puerto:** `account\domain\account\account.repository.ts` — `findByIdAndUser`, `findAllByUser`, `save`, `softRemove`, `hasMovements(id)`. **No hay** método de suma de saldo.
- **Suma existente (insuficiente):** `movement.repository.ts` → `sumAmount(MovementSumQuery)` está scopeado por **categoría** (`category` obligatorio), no por cuenta ni por todos los tipos. Para el saldo hace falta un `SUM` por `account` sumando `INCOME`+`TRANSFER_IN` y restando `EXPENSE`+`TRANSFER_OUT`, excluyendo soft-deleted.
- **HTTP:** `account\infrastructure\adapters\http\account.controller.ts` — hoy `GET /accounts`, `GET /accounts/query`, `POST`, `DELETE /:id`.
- **Providers:** `account\account.module.ts` — `AccountRepository→TypeOrmAccountRepository` + 4 usecases.
- **Decisión sm-0001:** `GET /accounts/:id/balance` + saldo embebido en `GET /accounts`; cálculo **on-the-fly** con agregación SQL (índice `account_id` ya existe, migración 6).
- **GAP:** falta el método de repositorio de saldo por cuenta, el usecase y el endpoint. `AccountOutputDto` no incluye saldo.

### AC-4 — Edición de movimientos `PATCH /movements/:id` (módulo `movement`)

- **Entidad de dominio:** `movement\domain\movement\movement.entity.ts` — ya tiene `update(payload)` y separa `merchant` (ingesta) de `notes` (usuario). Campos: `type, description, merchant?, notes?, amount, currency, paymentMethod?, source, categoryId, subcategoryId?, accountId, externalReference?, transferGroup?, invoice*`.
- **Tipos:** `movement.types.ts` — `MovementType {INCOME,EXPENSE,TRANSFER_IN,TRANSFER_OUT}`, `reportableMovementTypes`, `PaymentMethod`, `MovementSource {MANUAL,WEBHOOK,SCHEDULED}`.
- **Puerto:** `movement.repository.ts` — `findById`, `findByIdAndUser`, `findByExternalReference`, `findAll`, `save`, `saveAll`, `remove`, `sumAmount`. **No hay** `update` dedicado (se reusaría `save` sobre la entidad recuperada).
- **Usecases actuales:** `movement\application\usecases\index.ts` → find, findAll, save, remove (no update).
- **DTOs:** `movement\application\dto\index.ts` → `MovementInputDto`, `MovementOutputDto`, `MovementFilterDto`.
- **Providers:** `movement\movement.module.ts` — `MovementRepository→TypeOrmMovementRepository`, importa `CategoryModule` (regla subcategoría↔categoría) y `AccountModule`; exporta `MovementRepository`.
- **Decisión sm-0001:** PATCH no cambia `type` ni edita transferencias; en `source=WEBHOOK` solo campos del usuario (`notes`, `categoryId`, `subcategoryId`, `paymentMethod`), datos de ingesta protegidos.
- **GAP:** falta `UpdateMovementUsecase`, `MovementPatchDto` y la ruta `PATCH`. La validación de campos permitidos según `type`/`source` es lógica nueva.

### AC-5 — CRUD de scheduled + anular transferencia (módulos `scheduled`, `transfer`)

- **Scheduled entidad:** `scheduled\domain\scheduled\scheduled.entity.ts` — `date` (próxima ocurrencia), `type, amount, currency, categoryId, subcategoryId, accountId, user, frequency: Frequency`, con `recurs()` y `advance()`. Editar el template **no toca** movimientos ya materializados (son filas `Movement` aparte) → alineado con la decisión.
- **Scheduled puerto:** `scheduled.repository.ts` — `findByIdAndUser`, `findAll`, `findDue`, `save`, `remove`. Reusar `save` para editar.
- **Scheduled usecases:** `scheduled\application\usecases\index.ts` → find, findAll, save, remove, generate-movements (no update dedicado, pero `save` sirve).
- **Transfer:** `transfer\transfer.module.ts` — **no posee tabla**; solo `CreateTransferUsecase` + `TransferController` (`POST /transfers`). Orquesta `AccountRepository` + `MovementRepository.saveAll`.
- **Transfer create (referencia):** `transfer\application\usecases\create-transfer.usecase.ts` — crea par `TRANSFER_OUT`/`TRANSFER_IN` con `transferGroup = randomUUID()` en una transacción vía `saveAll`.
- **Decisión sm-0001:** editar scheduled solo afecta ocurrencias futuras; anular transferencia = **reversa compensatoria** (par nuevo que compensa, mismo `transferGroup`), sin borrar.
- **GAP:** falta `UpdateScheduledUsecase`/endpoint de edición explícito; falta `ReverseTransferUsecase` + endpoint. No hay forma de recuperar ambas patas por `transferGroup` en `MovementRepository` (no hay `findByTransferGroup`).

### AC-6 — Reversa de movimiento de webhook (módulo `webhook`)

- **Controller:** `webhook\infrastructure\adapters\http\webhook.controller.ts` — `POST /webhooks/transactions`, `@Public()` + `WebhookApiKeyGuard`.
- **Usecase actual:** `webhook\application\usecases` → `ReceiveWebhookTransactionUsecase` (idempotente por `externalReference`).
- **Idempotencia disponible:** `MovementRepository.findByExternalReference(externalReference)`.
- **Providers:** `webhook\webhook.module.ts` — importa `CategoryModule`, `MovementModule`, `AccountModule`; provee `ReceiveWebhookTransactionUsecase`.
- **Decisión sm-0001:** reversa = **movimiento compensatorio**; recurso REST dedicado `POST /webhooks/transactions/{externalReference}/reversal`, protegido con la API key del webhook.
- **GAP:** falta `ReverseWebhookTransactionUsecase` + ruta. Idempotencia de la reversa (no compensar dos veces el mismo `externalReference`) es lógica nueva.

---

## Patrón de inyección (use case de referencia)

**Archivo:** `apps\finances\src\transfer\application\usecases\create-transfer.usecase.ts`
```typescript
@Injectable()
export class CreateTransferUsecase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly movementRepository: MovementRepository,
  ) {}
  async execute(input: TransferInputDto, user: number): Promise<TransferOutputDto> { ... }
}
```
Puertos inyectados por su `abstract class` (sin `Symbol`/token). Un usecase por acción, `execute(...)`.

## Configuración disponible (env)

**Archivo:** `apps\finances\src\env.ts` — `ENV, PORT, DB_TYPE, DB_URI, DB_SSL, DB_SYNCHRONIZE, SHOW_DOCS, OIDC_ISSUER, OIDC_AUDIENCE, AUTH_IDENTITY_PROVIDER, USERS_API_URL, WEBHOOK_API_KEY`.
- `USERS_API_URL` ya existe → canal para leer la preferencia de moneda del usuario (AC-2).
- **GAP env:** faltarán claves para la cola sobre Postgres (AC-1) y para `exchanges`/`ExchangeRateProvider` (AC-2).

## Identidad del usuario autenticado

`AuthenticatedUser`/`CurrentUser` provienen de `@shared`. Todos los controllers de datos personales reciben `@CurrentUser() user` y pasan `user.id` al usecase. Verificar en `libs/shared` qué campos trae `AuthenticatedUser` (para saber si la moneda de presentación viaja en el token o hay que pedirla a `users`).

---

## Gaps detectados

1. **Documentación:** no existe estructura `docs/services/<micro>/`. La única doc del proyecto es `RESUMEN_EJECUTIVO.md` (índice de componentes según el perfil).
2. **AC-1 mensajería:** no hay infraestructura de cola; hoy `EventEmitter2` in-process. Introducir adaptador postgresmq/PGMQ + estado de idempotencia por (budget, período, umbral).
3. **AC-2 tasas:** no existe `ExchangeRateProvider` ni adaptador; `apps/exchanges` roto. Reconstruirlo es trabajo aparte (fuera de alcance declarado).
4. **AC-2 moneda de presentación:** preferencia por usuario que hoy no existe; vive en `users` — definir contrato de lectura vía `USERS_API_URL` y si viaja en el JWT.
5. **AC-3 saldo:** no hay método de suma por cuenta (el `sumAmount` actual es por categoría), ni usecase, ni endpoint, ni campo en `AccountOutputDto`.
6. **AC-4 PATCH:** no hay `UpdateMovementUsecase`, DTO de patch, ni ruta; validación de campos editables por `type`/`source` es nueva.
7. **AC-5:** falta edición explícita de scheduled y `ReverseTransferUsecase`; no hay `findByTransferGroup` en `MovementRepository`.
8. **AC-6:** falta `ReverseWebhookTransactionUsecase` + ruta `.../reversal` e idempotencia de la reversa.
9. **Alcance:** sm-0001 es muy transversal (toca 6 módulos + 2 microservicios). `/plan` probablemente deba fragmentarla por AC para lotes de implementación manejables.
