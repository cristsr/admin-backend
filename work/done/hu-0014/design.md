# design: hu-0014

> **Historia de reconciliación documental, no de construcción.** El código de esta HU ya
> estaba implementado antes de correr `/design`. Este documento describe el diseño
> **as-built** (verificado contra el código, no contra la spec) y registra el estado de la
> reconciliación ya ejecutada. **No hay delta** (`model.delta.c4`, `api.delta.yaml`,
> `flows/*.md`): los docs vivos del módulo `transactions` ya fueron reconciliados a mano en
> esta sesión — ver «Estado de reconciliación documental».

## Decisiones de Diseño

> ⚠️ **`/sync`: NO appendear esta sección a `docs/decisions.md`.** La entrada
> **`## HU-0014 — Endpoints de transacciones — ciclo de vida completo (2026-07-25)`** **ya
> está appendeada** en `docs/decisions.md` (es la entrada más reciente, encabeza el log).
> Lo de abajo es un resumen que **referencia** esa entrada; volver a appendearlo produciría
> una doble entrada.

### Correcciones de código aplicadas (3 defectos reales, no divergencias de spec)

- **Suite e2e desbloqueada:** `LedgerCoreModule` declara `PostgresEventStore` y
  `PostgresReadModelStore` como providers; Nest los instanciaba aunque el test sobrescribiera
  los buses, exigiendo un `DataSource` inexistente. Se agregó el override de `EventStore` y
  `ReadModelStore` **en los specs** (`transactions-api.e2e.spec.ts`, `accounts-api.e2e.spec.ts`);
  producción intacta. 13 tests rojos → 0.
- **`/amend` exige `postings` y `date`:** el agregado hace reemplazo total
  (`LedgerTransaction.amend(postings, date, balance)`), así que una enmienda parcial no tiene
  representación en el dominio. `AmendTransactionRequestDto` pasó ambos campos a requeridos
  (`@IsArray @ArrayMinSize(2) @ValidateNested` + `@IsDateString`), convirtiendo un `422`
  desconcertante en un `400` de validación claro.
- **Filtro `account` aplicado antes de paginar:** `ListTransactionsHandler` resuelve primero
  los `transaction_id` de la cuenta desde `proj_postings` y los inyecta como
  `criteria.oneOf('transaction_id', ...)` **antes** de `paginate(...)`. Cortocircuita con `[]`
  cuando la cuenta no tiene postings (`Criteria.oneOf` con array vacío devuelve `this` sin
  filtro y habría listado todo). Se aplica además el `limit` por defecto de
  `DEFAULT_TRANSACTION_PAGE_SIZE = 50`, que el DTO anunciaba en Swagger pero nunca se usaba.

### Divergencias documentadas (el código se mantiene, se corrigió la spec)

- `GET /transactions` devuelve un **array crudo** de filas, no una página: `TransactionListDto`
  (`items`/`total`/`limit`/`offset`) solo decora Swagger vía `@ApiOkResponse`, nunca se
  construye — `queryBus.ask<TransactionListDto>(...)` es un genérico sin verificación.
- `GET /transactions/{id}` devuelve la fila cruda **sin postings**, o `200 null` (no `404`).
- El rango de fechas es `from`/`to`, no `period`.
- Un solo posting da **`400`, no `422`**: el `ArrayMinSize(2)` del DTO gana en el
  `ValidationPipe` y deja `INSUFFICIENT_POSTINGS` (INV-2) inalcanzable por HTTP.
- `/confirm` ignora el body por completo y `/reverse` ignora el `reason` (ambos `_dto`); los
  campos se conservan en el contrato pero se documentan como sin efecto.
- `/annotate` tiene semántica de **reemplazo total**, no de parche: `description ?? ''`,
  `tags ?? []`, `payee ?? null` **borran** el valor previo.
- `ACCOUNT_CLOSED` es `422`, no `409` (decisión congelada de HU-0011). `INVALID_TRANSACTION_STATE`
  es `409` y no figura en el const `LEDGER_ERROR_CODE` — ver la entrada de HU-0013.

## Resumen del diseño as-built

Un único driving adapter —`TransactionsController` (`@Controller({ path: 'transactions',
version: '1' })`, `@UseInterceptors(CommandResultInterceptor)`)— expone el ciclo de vida
completo del agregado `LedgerTransaction` sobre el patrón controller→bus de EP-1: nada de
lógica de dominio ni SQL en el adapter (RNF-10, Artículo 10). Los writes despachan un command
por el `CommandBus` con el `AuthContext` armado desde `@Context()` (headers `x-user-id` /
`x-client-id`) y `@ExternalRef()` (header `x-external-ref`, fallback al body). Los reads van
por el `QueryBus` con un `QueryContext` que solo lleva el `userId` (INV-9). El
`CommandResultInterceptor` proyecta el `CommandResult` a `CommandAcceptedDto`
(`{ id, streamPosition }`), estampa el header `X-Ledger-Stream-Position` (RNF-9) y degrada a
`200` cualquier replay idempotente (INV-10) — incluido el `201` de `POST /transactions` y de
`/reverse`.

**Escrituras — 1 registro + 5 transiciones, un command por verbo:**

| Método | Ruta | Command | Éxito |
|---|---|---|---|
| POST | `/api/v1/transactions` | `RecordTransactionCommand` | `201` |
| POST | `/api/v1/transactions/{id}/amend` | `AmendPendingTransactionCommand` | `200` |
| POST | `/api/v1/transactions/{id}/annotate` | `AnnotateTransactionCommand` | `200` |
| POST | `/api/v1/transactions/{id}/confirm` | `ConfirmTransactionCommand` | `200` |
| POST | `/api/v1/transactions/{id}/void` | `VoidPendingTransactionCommand` | `200` |
| POST | `/api/v1/transactions/{id}/reverse` | `ReverseConfirmedTransactionCommand` | `201` |

`confirm` y `reverse` reciben el body como `_dto` y construyen el command **solo con el `id`**.
`reverse` devuelve el id de la transacción de reversa (T2), no el de la original, que queda
inmutable en su stream (`metadata.reverses_id`).

**Lecturas — 2 rutas, ambas al `QueryBus`:**

| Método | Ruta | Query | Respuesta real |
|---|---|---|---|
| GET | `/api/v1/transactions` | `ListTransactionsQuery` | `200` array crudo de filas de `proj_transactions` |
| GET | `/api/v1/transactions/{id}` | `GetTransactionByIdQuery` | `200` fila cruda sin postings, o `null` |

**DTOs** (`.../adapters/http/dto/`): `RecordTransactionRequestDto` (+ `PostingDto` con
`amount` como `@IsNumberString`, INV-8), `AmendTransactionRequestDto` (ambos campos
requeridos), `AnnotateTransactionRequestDto` (todo opcional, semántica de reemplazo),
`ConfirmTransactionRequestDto` (`postings?` ignorado por el controller),
`VoidTransactionRequestDto` (`reason` requerido), `ReverseTransactionRequestDto`
(`reason?` ignorado), `TransactionQueryDto` (filtros `account`/`from`/`to`/`status`/
`derivedKind`/`payee`/`clientId` + `limit` 1..200 default 50 / `offset` ≥ 0), y los de lectura
`TransactionDto` / `TransactionPostingDto` / `TransactionListDto` (solo documentales).

**Queries y proyecciones:** `ListTransactionsHandler` y `GetTransactionByIdHandler` (registrados
en `createQueryBus`) leen `proj_transactions` vía `Criteria`, siempre con `equals('user_id',
ctx.userId)`; el filtro por cuenta cruza `proj_postings`. Ambas proyecciones las alimenta
`TransactionListProjector` desde los eventos del agregado — esta HU **no agregó proyectores ni
tablas nuevas**, solo consumidores de lectura.

**Wiring:** `TransactionsHttpModule` declara únicamente el controller (los buses son globales
de EP-1) y se reexporta desde `.../adapters/http/index.ts`.

## Componentes del módulo

Esta HU no agrega componentes nuevos al modelo C4 Nivel 3: consolida
`admin.ledger.transactions.controller` (`TransactionsController`) como el entrypoint REST de
los 6 handlers de ciclo de vida ya modelados (`recordHandler`, `amendHandler`,
`annotateHandler`, `confirmHandler`, `voidHandler`, `reverseHandler`) y suma las dos vistas de
lectura sobre `admin.ledger.shared.queryBus` → `admin.ledger.shared.readModel`. El modelo vivo
está en `apps/ledger/docs/transactions/transactions.c4`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** **No.**

- **Nivel:** N/A.
- **Cambio:** ninguno.
- **Nodo/arista concreto:** N/A.

Fundamento contra el criterio (¿agrega/quita un módulo, app, integración o actor del
landscape?): la HU no crea ningún app ni módulo —`transactions` ya existe en
`docs/architecture/landscape.c4` y su `.c4` de Nivel 3 ya estaba poblado—, no introduce ni
elimina integración con ningún sistema externo, broker o API de terceros (el controller solo
habla con los buses in-process de EP-1), y no suma actores: el único actor es el `user`
autenticado que ya consumía `/accounts` en hu-0013 vía los mismos headers de gateway. El
alcance es enteramente interno al módulo `transactions` y a su adapter HTTP.

> **`/sync`: no invocar `/architecture`.**

## Estado de reconciliación documental

El delta **no aplica**: la reconciliación ya fue ejecutada y validada en esta sesión, y los
docs vivos ya están en su estado final. `/sync` debe tratar esta HU como **ya reconciliada** y
limitarse a archivar el workspace en `work/done/hu-0014/`.

| Artefacto vivo | Estado |
|---|---|
| `apps/ledger/docs/transactions/transactions.c4` | Reconciliado — `dynamic view getTransaction` nueva; `listTransactions` corregida (filtro antes de paginar, array crudo). Sin tags `#delta-*` ni prefijos `[NEW]`/`[CHANGED]` pendientes de limpiar. |
| `apps/ledger/docs/transactions/flows/confirm-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/amend-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/annotate-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/void-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/reverse-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/get-transaction.md` | Nuevo — `introduced_by: hu-0014`. |
| `apps/ledger/docs/transactions/flows/list-transactions.md` | Corregido — `introduced_by: hu-0003`, `last_modified_by: hu-0014`. |
| `apps/ledger/docs/transactions/api.yaml` | Reconciliado — list/get devuelven array crudo y `200 null`; `amend` con campos requeridos; `confirm`/`reverse` documentan que ignoran el body; headers de idempotencia (`X-External-Ref`, `X-Ledger-Stream-Position`). |
| `docs/decisions.md` | **Ya appendeado** — sección `## HU-0014 …`. **No volver a appendear.** |
| `work/active/hu-0014/docs/` | No existe y no debe generarse: no hay delta que reconciliar. |

Flujos cubiertos por la HU (slugs estables, sin colisiones nuevas): `record-transaction`
(preexistente, sin cambios), `confirm-transaction`, `amend-transaction`, `annotate-transaction`,
`void-transaction`, `reverse-transaction`, `get-transaction`, `list-transactions`.

## Modelado de datos

Sin cambios. No hay tabla ni tipo de dato nuevo: la HU solo lee `proj_transactions` y
`proj_postings`, ambas ya creadas por la proyección `transaction_list` de hu-0006.

## Validación de Quality Gates

Validado contra los 4 gates obligatorios de [`docs/rules.md`](../../../docs/rules.md), evaluados
sobre el código as-built.

| Gate | Resultado | Justificación |
|---|---|---|
| Simplicity | ✅ | Ninguna capa ni abstracción nueva: un controller sobre los buses existentes y DTOs planos. No se introdujo un envoltorio de paginación ni un mapper de lectura — el handler devuelve la fila de la proyección tal cual. |
| Anti-Abstraction | ✅ | Se usan NestJS y `class-validator` directos (`@Body`, `@Query`, `ValidationPipe`, `ArrayMinSize`) y el `Criteria` compartido de `libs/shared`, sin envolverlos. El filtro `account` se resuelve con `Criteria.oneOf`, no con un query builder propio. |
| Integration-First | ✅ | `apps/ledger/docs/transactions/api.yaml` es el contrato canónico del módulo y quedó alineado campo a campo con los DTOs; `transactions-api.e2e.spec.ts` (9 casos) ejerce las rutas end-to-end como contract tests. Nota: por ser HU de reconciliación, el contrato se **alineó** al código en vez de precederlo — ver «Excepciones». |
| Test-First | ⚠️ | Ver «Excepciones»: el código precede a este diseño. Las tres correcciones sí se hicieron con test primero (`list-transactions.handler.spec.ts`, 4 casos nuevos; `transactions.controller.spec.ts` reescrito para el amend real, 8 casos). Cobertura vigente: 9 e2e + 8 de controller + 4 de handler, en verde. |

## Excepciones a la constitución

- **Artículo 4 (TDD estricto) / Test-First Gate — excepción justificada.** Esta HU es de
  **sincronización documental**: el código ya existía cuando se corrió el pipeline, así que
  ningún test pudo escribirse antes que él. La excepción se acota a lo preexistente; las tres
  correcciones aplicadas en esta sesión sí siguieron el ciclo rojo→verde (el test del amend
  que congelaba el bug dejó de compilar y se reescribió; el handler de listado se cubrió con 4
  casos nuevos antes de reordenar el filtro). Mismo precedente que HU-0011, HU-0012 y HU-0013.
- **Integration-First — matiz, no incumplimiento.** El `api.yaml` no precedió a la
  implementación por la misma razón; se reconcilió contra el runtime real y desde ahora vuelve
  a ser el contrato que gobierna cambios futuros del módulo.
