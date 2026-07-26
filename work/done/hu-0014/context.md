# context: hu-0014

> **Naturaleza de este scan:** la historia **ya está implementada** en `apps/ledger`
> (commits `6916511`, `b5b9ba8`, `6f173f3`). No es un scan pre-diseño clásico: además del
> inventario de artefactos reutilizables, este documento **verifica el estado real de la
> implementación contra cada AC** y consolida los gaps al final.

## Historia resumida

**Como** cliente autenticado del ledger
**Quiero** registrar transacciones de partida doble y ejecutar su ciclo de vida completo
(confirmar, enmendar, anotar, anular, revertir) y listarlas con filtros y paginación vía HTTP
**Para** operar mi contabilidad personal desde el frontend y el sistema de correos, con errores
de dominio de código estable, read-your-writes e idempotencia

## Componentes afectados

- `ledger` (app) — objetivo principal, módulo `transactions` + `read-side`
- `shared` (lib) — `ExceptionFilter`, jerarquía `DomainException`, `Criteria`, `Nullable` (reuso tal cual)

## Estado del repositorio (read-only)

- Rama actual: **`feat/core`** (el perfil declara `BASE_BRANCH = develop`; no existe rama
  `develop` en uso — el flujo real del repo trabaja sobre `feat/core` contra `master`).
- Working tree con cambios sin commitear ajenos a esta HU (`projection-rebuilder`, `tooling/`,
  `landscape.c4`, `transactions.c4`, `package.json`). El scan lee el código tal como está.
- `work/active/` contiene `hu-0012`, `hu-0013` y `hu-0014`, las tres solo con `hu.md`.

---

## ledger

### Módulo afectado

`D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\`
Lecturas: `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\`

### Adaptador HTTP (existe completo)

**Controller:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\adapters\http\transactions.controller.ts`

| Ruta | Método | Línea | Status | Command / Query |
|---|---|---|---|---|
| `POST /api/v1/transactions` | `record` | 53–73 | 201 | `RecordTransactionCommand` |
| `GET /api/v1/transactions` | `list` | 75–93 | 200 | `ListTransactionsQuery` |
| `GET /api/v1/transactions/:id` | `getOne` | 95–103 | 200 | `GetTransactionByIdQuery` |
| `POST /:id/amend` | `amend` | 105–122 | 200 | `AmendPendingTransactionCommand` |
| `POST /:id/annotate` | `annotate` | 124–144 | 200 | `AnnotateTransactionCommand` |
| `POST /:id/confirm` | `confirm` | 146–157 | 200 | `ConfirmTransactionCommand` |
| `POST /:id/void` | `void` | 159–170 | 200 | `VoidPendingTransactionCommand` |
| `POST /:id/reverse` | `reverse` | 172–182 | 201 | `ReverseConfirmedTransactionCommand` |

- Solo depende de `CommandBus` + `QueryBus` (líneas 48–51) — cumple RNF-10 / Artículo 10.
- `@UseInterceptors(CommandResultInterceptor)` (línea 46) serializa `CommandResult` →
  `CommandAcceptedDto` + header `X-Stream-Position` y degrada a 200 en replay idempotente.
- Helpers privados: `dispatch()` (185–197), `queryContext()` (200–202), `toPostings()` (205–212),
  `toStringMetadata()` (215–221).

**Módulo Nest:** `...\http\transactions-http.module.ts` — solo declara el controller (buses son globales).
**Barrel:** `...\http\index.ts` → `dto`, `transactions.controller`, `transactions-http.module`, `transfer.controller`.
**Wiring:** `D:\Cristian\Nest\admin-back\apps\ledger\src\app.module.ts:38` importa `TransactionsHttpModule`.

### DTOs HTTP (existen todos los previstos)

Directorio: `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\adapters\http\dto\`

| Archivo | Clase | Notas |
|---|---|---|
| `posting.dto.ts` | `PostingDto` | `amount` con `@IsNumberString()` (INV-8 ✔), `accountId` `@IsUUID`, `currency`, `metadata?` |
| `record-transaction-request.dto.ts` | `RecordTransactionRequestDto` | `@ArrayMinSize(2)`, `@IsIn([PENDING, CONFIRMED])`, `@IsDateString` |
| `amend-transaction-request.dto.ts` | `AmendTransactionRequestDto` | `postings?`, `date?` (ambos opcionales) |
| `annotate-transaction-request.dto.ts` | `AnnotateTransactionRequestDto` | los 5 campos opcionales |
| `confirm-transaction-request.dto.ts` | `ConfirmTransactionRequestDto` | `postings?` |
| `void-transaction-request.dto.ts` | `VoidTransactionRequestDto` | `reason` requerido |
| `reverse-transaction-request.dto.ts` | `ReverseTransactionRequestDto` | `reason?` |
| `transaction-query.dto.ts` | `TransactionQueryDto` + `MAX_TRANSACTION_PAGE_SIZE = 200` | `account`, `from`, `to`, `status`, `derivedKind`, `payee`, `clientId`, `limit`, `offset` |
| `transaction.dto.ts` | `TransactionDto`, `TransactionPostingDto` | forma camelCase con `postings[]` |
| `transaction-list.dto.ts` | `TransactionListDto` | `{ items, total, limit, offset }` |
| `index.ts` | barrel | exporta los 10 |

### Commands y handlers (EP-1, reutilizados)

`D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\application\`

| Command | Firma | Handler |
|---|---|---|
| `RecordTransactionCommand` | `(date, payee, description, postings, initialStatus, invoiceUrl, tags, metadata)` | `record-transaction/record-transaction.handler.ts` |
| `AmendPendingTransactionCommand` | `(transactionId, date, postings)` — **ambos obligatorios** | `amend-transaction/amend-pending-transaction.handler.ts` |
| `AnnotateTransactionCommand` | `(transactionId, payee, description, invoiceUrl, tags, metadata)` — **reemplazo total** | `annotate-transaction/annotate-transaction.handler.ts` |
| `ConfirmTransactionCommand` | `(transactionId)` — **sin postings** | `confirm-transaction/confirm-transaction.handler.ts` |
| `VoidPendingTransactionCommand` | `(transactionId, reason)` | `void-transaction/void-pending-transaction.handler.ts` |
| `ReverseConfirmedTransactionCommand` | `(transactionId)` — **sin reason** | `reverse-transaction/reverse-confirmed-transaction.handler.ts` |

- `ReverseConfirmedTransactionHandler:64-68` retorna `aggregateId: reversing.id` → el id de la
  reversa (T2), como pide AC-2; `metadata: { reverses_id: original.id }` (línea 49) y el append
  de la reversa va `anchorless` (`externalRef: null`, línea 59).

### Agregado y dominio

`...\transactions\domain\transaction\ledger-transaction.aggregate.ts`

| Método | Línea | Guard |
|---|---|---|
| `amend` | 112 | no-PENDING → `ImmutableTransactionException` (409 / `IMMUTABLE_TRANSACTION`) |
| `annotate` | 124 | VOIDED → `InvalidTransactionStateException` (409) |
| `confirm` | 133 | no-PENDING → `InvalidTransactionStateException` |
| `void` | 144 | no-PENDING → `InvalidTransactionStateException` |
| `reverse` | 159 | no-CONFIRMED / ya reversada → `InvalidTransactionStateException` |
| `ensureWellFormed` | 229–240 | `UnbalancedTransactionException` (INV-1), `InsufficientPostingsException` (INV-2) |

Excepciones: `...\domain\transaction\exceptions\transaction.exception.ts`
Balanceo: `...\domain\balance\zero-sum-balance-rule.ts` (Artículo 12 ✔)

### Lado de lectura

- `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\list-transactions\list-transactions.query.ts`
  `(accountId, status, derivedKind, payee, clientId, fromDate, toDate, limit, offset)`
- `...\read-side\list-transactions\list-transactions.handler.ts` — devuelve
  `readonly TransactionRow[]` (filas crudas `snake_case`), pagina solo `if (query.limit)`
  (línea 41) y aplica el filtro `account` **después** de paginar (líneas 47–51).
- `...\read-side\get-transaction-by-id\get-transaction-by-id.handler.ts` — devuelve
  `Nullable<TransactionRow>` (fila cruda, sin postings), `null` si no existe (línea 30).
- Registro: `...\read-side\query-bus.factory.ts:14-15`.
- Proyección: `...\transactions\infrastructure\projections\transaction-list.projector.ts`
  (`proj_transactions`, `proj_postings`; `derived_kind` derivado en línea 81).

### Contexto autenticado, idempotencia y errores (reutilizables tal cual)

`D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\`
- `context.decorator.ts` → `@Context()`; `external-ref.decorator.ts` → `@ExternalRef()`
- `command-result.interceptor.ts` → `CommandAcceptedDto` + `STREAM_POSITION_HEADER`
- `ledger-context.guard.ts` (401 sin contexto) + `resolvers/gateway-header-context.resolver.ts`
- `dto/command-accepted.dto.ts` → `{ id, streamPosition }`
- Códigos estables: `...\shared\domain\errors\ledger-error-code.ts` + contract test
  `ledger-error-code-mapping.spec.ts`

### Tests existentes

| Archivo | Cubre |
|---|---|
| `...\http\transactions.controller.spec.ts` | 8 casos con `CommandBus`/`QueryBus` mockeados (record, confirm, amend, annotate, void, reverse, list, getOne) |
| `...\http\transactions-api.e2e.spec.ts` | 8 casos e2e con buses mockeados: 401 sin contexto, 201 + header, `external_ref`, replay 200, 422 `UNBALANCED_TRANSACTION`, 400 un solo posting, confirm 200, list con filtros |
| `...\application\*\*.handler.spec.ts` | los 6 handlers de ciclo de vida |
| `...\domain\transaction\ledger-transaction.aggregate.spec.ts` | invariantes del agregado |
| `...\shared\domain\errors\ledger-error-code-mapping.spec.ts` | tabla código → status |
| `...\transactions\transactions.merge-transfers.e2e-spec.ts` | e2e in-memory de transferencias (no de este ciclo de vida) |

### Documentación disponible

`D:\Cristian\Nest\admin-back\apps\ledger\docs\transactions\`
- `README.md` — arc42-lite; tabla de casos de uso lista las 6 transiciones, pero 5 sin doc de flujo
  (líneas 23–27 apuntan a la view, no a un `flows/*.md`).
- `transactions.c4` — modelo C4 L3 completo, con dynamic views `recordTransaction`,
  `amendTransaction`, `annotateTransaction`, `confirmTransaction`, `voidTransaction`,
  `reverseTransaction`, `listTransactions` (líneas 126–232).
- `api.yaml` — OpenAPI 3.1 con las 8 operaciones y los schemas de request/response.
- `flows/` — solo `record-transaction.md`, `list-transactions.md`, `detect-transfer.md`,
  `project-transaction-list.md`, `project-account-balances.md`.

---

## Verificación AC por AC (estado real)

| AC | Estado | Evidencia |
|---|---|---|
| AC-1 Registrar transacción | ✅ Cubierto | `transactions.controller.ts:53-73`; e2e `transactions-api.e2e.spec.ts:73-82` |
| AC-2 `/confirm` | ⚠️ Parcial | `ConfirmTransactionRequestDto.postings` se descarta (`_dto`, `transactions.controller.ts:154`) |
| AC-2 `/amend` | ⚠️ Divergente | `date`/`postings` opcionales en el DTO pero obligatorios de facto (`transactions.controller.ts:117-118`) |
| AC-2 `/annotate` | ⚠️ Divergente | semántica de reemplazo total, no parcial (`transactions.controller.ts:136-140`) |
| AC-2 `/void` | ✅ Cubierto | `transactions.controller.ts:169` |
| AC-2 `/reverse` 201 + id T2 | ⚠️ Parcial | 201 e id de reversa ✔ (`reverse-confirmed-transaction.handler.ts:66`); `reason` descartado (`transactions.controller.ts:179`) |
| AC-3 `GET /transactions` → `TransactionListDto` | ❌ No cubierto | handler devuelve array crudo (`list-transactions.handler.ts:31`) |
| AC-3 `GET /transactions/{id}` → `TransactionDto` | ❌ No cubierto | handler devuelve fila cruda o `null` (`get-transaction-by-id.handler.ts:24-30`) |
| AC-3 filtro `period` | ⚠️ Divergente | implementado como `from`/`to` (`transaction-query.dto.ts:21-29`) |
| AC-4 desbalanceada → 422 | ✅ Cubierto | `transactions-api.e2e.spec.ts:104-112` |
| AC-4 un solo posting → 422 | ⚠️ Divergente | devuelve **400** por `ArrayMinSize` (`transactions-api.e2e.spec.ts:114-121`) |
| AC-5 montos decimal string | ✅ Cubierto | `posting.dto.ts:16` `@IsNumberString()` |
| AC-6 `amend` CONFIRMED → 409 `IMMUTABLE_TRANSACTION` | ✅ Cubierto (unit) | `ledger-transaction.aggregate.ts:112-117` + `ledger-error-code-mapping.spec.ts:58` |
| AC-6 `void` CONFIRMED → 409 | ✅ Cubierto (unit) | `ledger-transaction.aggregate.ts:144-150`; código `INVALID_TRANSACTION_STATE` fuera del catálogo |
| AC-6 cuenta cerrada → 409 `ACCOUNT_CLOSED` | ❌ Divergente | mapeado a **422** por decisión de HU-0011 (`ledger-error-code-mapping.spec.ts:55-57`) |
| AC-6 moneda no permitida → 422 | ✅ Cubierto | `ledger-error-code-mapping.spec.ts:54` |
| AC-7 read-your-writes | ⚠️ Parcial | header emitido por el interceptor; sin test POST→GET real |
| AC-7 idempotencia | ✅ Cubierto | `transactions-api.e2e.spec.ts:94-102` |
| AC-8 filtros observables | ⚠️ Parcial | e2e solo verifica el forwarding con bus mockeado (`transactions-api.e2e.spec.ts:131-140`) |

---

## Gaps detectados

### 1. Gaps de implementación

| # | AC / Tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| I-1 | AC-3 — `GET /transactions` no devuelve `TransactionListDto` | `apps\ledger\src\read-side\list-transactions\list-transactions.handler.ts:20-52` devuelve `readonly TransactionRow[]` (`snake_case`, sin `total`/`limit`/`offset`); el controller declara `Promise<TransactionListDto>` (`transactions.controller.ts:78`) | **Alta** | Envolver la respuesta en la página `{ items, total, limit, offset }` con mapeo a camelCase (mapper en el read-side o en el adaptador HTTP) y devolver `total` real |
| I-2 | AC-3 — `GET /transactions/{id}` no devuelve `TransactionDto` ni 404 | `get-transaction-by-id.handler.ts:24-30` devuelve la fila cruda sin `postings` y `null` cuando no existe → HTTP 200 con cuerpo vacío, aunque `api.yaml:123-124` documenta 404 | **Alta** | Mapear la fila + `proj_postings` a `TransactionDto` y lanzar `TransactionNotFoundException` (404 `TRANSACTION_NOT_FOUND`) cuando no hay fila |
| I-3 | AC-2 — `/annotate` sobrescribe con vacíos los campos omitidos | `transactions.controller.ts:136-140` rellena `description: ''`, `tags: []`, `metadata: {}`, `invoiceUrl: null`; `AnnotateTransactionHandler:26-32` aplica reemplazo total y el proyector persiste esos vacíos (`transaction-list.projector.ts:137-148`) | **Alta** | Definir semántica: o bien merge parcial (command con campos `Nullable`/`undefined` y agregado que conserva lo ausente), o bien exigir todos los campos en el DTO y documentarlo como PUT-like |
| I-4 | AC-2 — `/amend` con `date`/`postings` opcionales falla | `transactions.controller.ts:117-118` pasa `''` y `[]`; `LedgerDate.of('')` lanza `InvalidLedgerDateException` (`ledger-date.ts:15-17`) y `ensureWellFormed([])` lanza `InsufficientPostingsException` | **Alta** | Hacer el command tolerante (fallback a la fecha/postings actuales del agregado) o marcar ambos campos como requeridos en el DTO y en `api.yaml` |
| I-5 | AC-2 — `/confirm` descarta `postings` | `transactions.controller.ts:154` (`_dto`) y `ConfirmTransactionCommand` sin campo `postings`; el DTO y `api.yaml:374-382` los anuncian | **Media** | Propagar `postings?` al command y aplicar el ajuste antes de confirmar, o eliminar el campo del DTO/OpenAPI |
| I-6 | AC-2 — `/reverse` descarta `reason` | `transactions.controller.ts:179` (`_dto`) y `ReverseConfirmedTransactionCommand` sin `reason`; la descripción de la reversa es fija (`reverse-confirmed-transaction.handler.ts:44`) | **Media** | Propagar `reason` al command y usarlo como `description`/`metadata.reason` de T2, o eliminarlo del contrato |
| I-7 | AC-3/AC-8 — paginación aplicada antes del filtro `account`; sin límite por defecto | `list-transactions.handler.ts:41-51`: `paginate` solo si `limit` viene, y el filtro por cuenta se aplica sobre la página ya recortada; `transaction-query.dto.ts:51-57` documenta `default: 50` que nadie aplica | **Alta** | Mover el filtro por cuenta al `Criteria` (o pre-filtrar ids antes de paginar) y aplicar el default de `limit` en el handler |
| I-8 | AC-4 — un solo posting devuelve 400, no 422 | `record-transaction-request.dto.ts:47` `@ArrayMinSize(2)` corta antes del dominio; el e2e congela 400 (`transactions-api.e2e.spec.ts:114-121`) | **Media** | Decidir la autoridad: quitar `ArrayMinSize` para que INV-2 responda 422 `INSUFFICIENT_POSTINGS`, o corregir el AC-4 vía `/refine` documentando el 400 de forma |
| I-9 | AC-6 — `ACCOUNT_CLOSED` responde 422, el AC pide 409 | `ledger-error-code-mapping.spec.ts:55-57` + decisión ya tomada en `docs\decisions.md` (HU-0011) | **Media** | Corregir AC-6 vía `/refine` a 422 (la decisión de HU-0011 es la vigente); no tocar el mapping |
| I-10 | AC-6/AC-4 — códigos `INVALID_TRANSACTION_STATE` e `INSUFFICIENT_POSTINGS` fuera del catálogo RF-14 | Definidos en `transaction.exception.ts:19,32` pero ausentes de `ledger-error-code.ts:8-26` y de la tabla congelada `ledger-error-code-mapping.spec.ts:52-72` | **Media** | Agregar ambos a `LEDGER_ERROR_CODE` y una fila cada uno al mapping-spec (cambio aditivo) |
| I-11 | AC-3 — filtro `period` del AC implementado como `from`/`to` | `transaction-query.dto.ts:21-29` vs AC-3 de `hu.md:38-39` | **Baja** | Alinear el AC vía `/refine` (el par `from`/`to` ya está en `api.yaml` y en el handler) |
| I-12 | `reverse()` devuelve un `ReversalPlan` que el handler ignora | `ledger-transaction.aggregate.ts:159-175` vs `reverse-confirmed-transaction.handler.ts:40-56`, que reconstruye la reversa por su cuenta | **Baja** | Usar el `ReversalPlan` o eliminarlo del agregado (duplicación de la regla de reversa) |

### 2. Gaps documentales

| # | AC / Tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| D-1 | `flows/` sin doc para 5 de los 6 flujos de ciclo de vida | `apps\ledger\docs\transactions\flows\` solo tiene `record-transaction.md`, `list-transactions.md` y los 3 no-REST; `README.md:23-27` marca amend/annotate/confirm/void/reverse como *(view …)* sin archivo | **Alta** | Crear `flows/amend-transaction.md`, `annotate-transaction.md`, `confirm-transaction.md`, `void-transaction.md`, `reverse-transaction.md` con el frontmatter estándar (`use_case`, `trigger`, `entrypoint`, `command`, `view`, `invariants`, `introduced_by: hu-0014`) |
| D-2 | Contradicción `api.yaml` ↔ `flows/list-transactions.md` ↔ código | `api.yaml:445-461` define `TransactionList` paginado; `flows\list-transactions.md:40-43` documenta la respuesta como `TransactionRow[]` crudo; el código sigue al flujo, no al OpenAPI | **Alta** | Resolver junto con I-1 y reconciliar ambos documentos con la implementación final |
| D-3 | No existe flujo documentado para `GET /transactions/{id}` | `api.yaml:104-124` expone la operación; no hay `flows/get-transaction.md` ni dynamic view en `transactions.c4:224-232` | **Media** | Agregar la dynamic view `getTransactionById` al `.c4` y su `flows/get-transaction.md` |
| D-4 | `api.yaml` documenta 404 en `GET /{id}` que la implementación no produce | `api.yaml:123-124` vs `get-transaction-by-id.handler.ts:30` | **Media** | Alinear con la corrección de I-2 |
| D-5 | Ninguna operación documenta las respuestas de error transversales | `api.yaml:25-33,144-152,…` solo lista 422/409 sin `$ref` a un `ErrorResponse`; faltan 401 (guard de contexto) y 400 (validación de forma) | **Media** | Agregar el schema `ErrorResponse` (código estable + statusCode) y las respuestas 400/401 a las 8 operaciones |
| D-6 | `docs\decisions.md` sin entrada para HU-0014 | La entrada más reciente es `HU-0011 … (2026-07-25)` (`docs\decisions.md:11`) | **Media** | Registrar en `/design`/`/sync` las decisiones de esta HU (semántica de annotate, autoridad del 400 vs 422, forma de la página) |
| D-7 | `README.md` del módulo no refleja el contrato de lectura ni la paginación | `apps\ledger\docs\transactions\README.md:18-33` (tabla de flujos) y `35-44` (invariantes) no mencionan `TransactionListDto`, `limit/offset` ni `MAX_TRANSACTION_PAGE_SIZE` | **Baja** | Actualizar la tabla de casos de uso y agregar la sección de contrato de lectura al reconciliar |
| D-8 | `transactions.c4` con cambios sin commitear y sin marcas de delta | `git status` → ` M apps/ledger/docs/transactions/transactions.c4` (solo migración de sintaxis de `views`) | **Baja** | Commitear el cambio de sintaxis por separado antes de que `/design` pinte el delta de esta HU |

### 3. Gaps de test

| # | AC / Tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| T-1 | AC-2 — sin e2e para `amend`, `annotate`, `void`, `reverse` | `transactions-api.e2e.spec.ts` solo ejercita `POST /transactions`, `POST /:id/confirm` y `GET /transactions` | **Alta** | Agregar un caso e2e por sub-recurso, incluido el **201** de `reverse` (hoy ningún test verifica ese status) |
| T-2 | AC-3 — sin test de la forma de la respuesta de listado ni de `GET /{id}` | `transactions.controller.spec.ts:102-116` mockea `{ items: [], total: 0 }` (forma que el handler real nunca produce); `:118-127` mockea `{}` | **Alta** | Test de contrato del handler real (`list-transactions.handler.spec.ts` no existe) verificando `{ items, total, limit, offset }` y el mapeo camelCase |
| T-3 | AC-7 — read-your-writes no verificado extremo a extremo | el único e2e mockea los buses (`transactions-api.e2e.spec.ts:45-49`); no hay e2e in-memory con proyecciones síncronas para transacciones (existe el patrón en `transactions.merge-transfers.e2e-spec.ts`) | **Alta** | e2e in-memory: `POST /transactions` → `GET /transactions/{id}` devuelve la transacción recién creada |
| T-4 | AC-8 — paginación `limit`/`offset` sin cobertura | ningún test envía `limit`/`offset` ni verifica el recorte ni el `total` | **Alta** | e2e con N transacciones: `?status=PENDING&limit=2&offset=2` y assert de página + total |
| T-5 | AC-6 — invariantes de transición sin cobertura HTTP | 409 `IMMUTABLE_TRANSACTION` e `INVALID_TRANSACTION_STATE` solo se prueban en el mapping-spec, nunca a través de `/amend` o `/void` | **Media** | e2e: `amend` sobre CONFIRMED → 409 con `code`; `void` sobre CONFIRMED → 409 |
| T-6 | AC-6 — `ACCOUNT_CLOSED` / `CURRENCY_NOT_ALLOWED` sin cobertura desde el endpoint | solo tabla de mapeo unitaria | **Media** | e2e con cuenta cerrada y con moneda no permitida vía `POST /transactions` |
| T-7 | AC-5 — no hay test negativo de `amount` numérico | `posting.dto.ts:16` sin test que verifique el 400 al enviar `amount: 31900` (número) | **Media** | Caso e2e/DTO: `amount` numérico o con formato inválido → 400 |
| T-8 | AC-2 — el unit test congela el comportamiento defectuoso de `amend` | `transactions.controller.spec.ts:71` afirma `postings: []` como salida esperada | **Media** | Actualizar el test junto con la corrección de I-4 |
| T-9 | AC-1 — `derivedKind` enviado por el cliente no se rechaza | `RecordTransactionRequestDto` no lo declara y `ValidationPipe` corre sin `forbidNonWhitelisted` (`transactions-api.e2e.spec.ts:54`) | **Baja** | Test que confirme que un `derivedKind` en el body se ignora (o se rechaza) según la restricción técnica de `hu.md:124` |

---

## Incógnitas para `/design`

1. **Semántica de `annotate`**: ¿merge parcial o reemplazo total? (I-3 depende de esta decisión).
2. **Autoridad de INV-2 en el borde**: ¿400 de forma (statu quo) o 422 del dominio como dice AC-4? (I-8).
3. **Alcance de la corrección**: ¿esta HU corrige el contrato de lectura (I-1/I-2, cambio de
   respuesta) o solo documenta lo implementado y difiere la corrección? Impacta `api.yaml` y
   `flows/list-transactions.md`.
