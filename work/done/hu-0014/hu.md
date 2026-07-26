# hu-0014: Endpoints de transacciones — ciclo de vida completo

## Historia de Usuario

**Como** cliente autenticado del ledger
**Quiero** registrar transacciones de partida doble y ejecutar su ciclo de vida completo
(confirmar, enmendar, anotar, anular, revertir) y listarlas con filtros y paginación vía HTTP
**Para** operar mi contabilidad personal desde el frontend y el sistema de correos, con
errores de dominio de código estable, read-your-writes e idempotencia

> Corresponde a **EP-2.5** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (sección EP-2.5). Depende del agregado
> `LedgerTransaction` y sus handlers (`hu-0003`/`hu-0005`), la proyección `transaction_list`
> (`hu-0006`), el andamiaje HTTP (`hu-0009`), el contexto autenticado (`hu-0010`), los códigos
> de error (`hu-0011`) y read-your-writes + idempotencia (`hu-0012`).

## Criterios de Aceptación

### AC-1: Registrar transacción

`POST /api/v1/transactions` con `{ date, payee?, description, status: PENDING|CONFIRMED,
postings[], invoiceUrl?, tags?, metadata? }` (+ `external_ref`) despacha `RecordTransaction` y
responde `201 CommandAcceptedDto`.

### AC-2: Transiciones de estado como sub-recursos POST de acción

Cada transición es un command distinto expuesto como sub-recurso POST y responde `200
CommandAcceptedDto` (salvo `reverse`, `201`):
- `/{id}/confirm` → `ConfirmTransaction`. **El body se ignora por completo** (`_dto`): el
  command es `new ConfirmTransactionCommand(id)`. Confirmar con postings distintos a los
  registrados no está soportado; para eso está `amend` antes de confirmar.
- `/{id}/amend` → `AmendPendingTransaction` (`{ postings, date }`, **ambos requeridos**). El
  agregado hace reemplazo total (`amend(postings, date, balance)`), así que una enmienda
  parcial no tiene representación en el dominio; omitir un campo devuelve `400` de
  validación.
- `/{id}/annotate` → `AnnotateTransaction` (`{ payee?, description?, invoiceUrl?, tags?, metadata? }`).
  **Semántica de reemplazo total, no de parche:** los campos omitidos se envían vacíos
  (`description ?? ''`, `tags ?? []`, `payee ?? null`) y por lo tanto **borran** el valor
  previo. Para conservar un campo hay que reenviarlo.
- `/{id}/void` → `VoidPendingTransaction` (`{ reason }`).
- `/{id}/reverse` → `ReverseConfirmedTransaction`. **El `reason?` del body se ignora**
  (`_dto`): el command es `new ReverseConfirmedTransactionCommand(id)`. Responde `201` con
  el id de la transacción de reversa (T2); la original queda inmutable en el stream
  (`metadata.reverses_id`).

### AC-3: Listado con filtros y paginación (RF-13)

`GET /api/v1/transactions` acepta filtros (`account`, `status`, `derivedKind`, `payee`,
`clientId`) + `limit`/`offset` y responde `200`. `GET /api/v1/transactions/{id}` responde
`200`. `derivedKind` es filtro de lectura calculado por el proyector (RF-4); el cliente
nunca lo envía al crear.

**El rango de fechas se expresa como `from`/`to`, no como `period`.** `TransactionQueryDto`
declara dos `IsDateString` opcionales que el handler traduce a
`between('date', fromDate, toDate)`.

**La respuesta es un array crudo de filas, no una página.** `ListTransactionsHandler`
devuelve `readonly TransactionRow[]` desde `proj_transactions`; no hay envoltorio con
`total`/`limit`/`offset`. El `TransactionListDto` decora Swagger vía `@ApiOkResponse` pero
no se construye: `queryBus.ask<TransactionListDto>(...)` es un genérico sin verificación. El
cliente pagina con `limit`/`offset` a ciegas — sin `total`, detecta el fin cuando recibe
menos filas que el `limit` pedido. `limit` por defecto es **50** y el máximo es 200.

**`GET /transactions/{id}` devuelve la fila cruda sin postings, o `null`.** No incluye las
líneas de la transacción (viven en `proj_postings`) y una transacción inexistente responde
`200` con cuerpo `null`, no `404 TRANSACTION_NOT_FOUND` — mismo patrón que
`GET /accounts/{id}` en `hu-0013`.

### AC-4: Balanceo y forma validados por la autoridad correcta

`POST /transactions` con postings desbalanceados → `422 UNBALANCED_TRANSACTION` (lo verifica
el agregado, INV-1).

Con un solo posting el resultado real es **`400`, no `422`**: el `ArrayMinSize(2)` del DTO
rechaza el body en el `ValidationPipe` antes de que el command llegue al agregado, así que
el `422 INSUFFICIENT_POSTINGS` (INV-2) que el dominio sabe emitir queda inalcanzable por
esta ruta. La autoridad conceptual del invariante sigue siendo el dominio —y lo verifica
cuando se lo invoca directamente—, pero **por HTTP gana la malla de forma**. Se documenta el
`400` como el contrato observable.

### AC-5: Montos como decimal string (INV-8)

Los `PostingDto` reciben `amount` como decimal string (`@IsNumberString`), nunca como `number`
(TS `number` es float). El dominio reconstruye `Money` desde el string.

### AC-6: Invariantes de transición con código estable

- `amend` sobre una `CONFIRMED` → `409 IMMUTABLE_TRANSACTION` (enmienda solo en `PENDING`, INV-6).
- `void` sobre una `CONFIRMED` → `409 INVALID_TRANSACTION_STATE` (solo `PENDING` se anula).
- posting sobre una cuenta cerrada → **`422 ACCOUNT_CLOSED`, no `409`** — status congelado
  por la decisión de `hu-0011`: es una violación semántica del payload que el cliente
  corrige eligiendo otra cuenta, misma categoría que `CURRENCY_NOT_ALLOWED`.
- moneda no permitida por la cuenta → `422 CURRENCY_NOT_ALLOWED`.

`INVALID_TRANSACTION_STATE` e `INSUFFICIENT_POSTINGS` son códigos reales que el dominio
emite pero que **no figuran en el const `LEDGER_ERROR_CODE`** — ver la entrada de HU-0013 en
`docs/decisions.md`: el const declara 17 de los 39 códigos que el API puede emitir. Ambos
están documentados en la tabla de `map-domain-error.md`.

### AC-7: Read-your-writes e idempotencia

`POST /transactions` seguido de `GET /transactions/{id}` muestra la transacción (read-your-writes).
Reenviar con el mismo `external_ref` devuelve el resultado original sin emitir eventos nuevos.

### AC-8: Filtros observables

`GET /transactions?payee=Netflix` devuelve solo las coincidentes. `GET
/transactions?status=PENDING` pagina con `limit`/`offset`.

## Reglas de Negocio

- Sub-recursos de acción (un command por verbo) en vez de un `PATCH` genérico: cada transición
  tiene invariantes distintos y el contrato queda autodocumentado.
- `reverse` no muta la original: crea una transacción de reversa (T2) con
  `metadata.reverses_id = {id}` (§7.3); el stream permanece inmutable.
- El balanceo a cero por moneda (INV-1) y el mínimo de 2 postings (INV-2) son autoridad del
  agregado `LedgerTransaction`, no del DTO.
- Montos siempre decimal string (INV-8); fechas contables planas sin zona (RNF-7).
- Toda ruta exige contexto autenticado (`hu-0010`) y acota lecturas al `user_id`.
- El controller no arma SQL ni criteria de dominio: pasa el query al bus; el query handler
  traduce a la consulta de la proyección `transaction_list`.
- TDD estricto (controller con buses mockeados + e2e in-memory con proyecciones síncronas).

## Fuera de Alcance

- Transferencias (`/transfers/*`) y balance assertions → EP-3.
- Monedas, precios, presupuestos, metas, reportes → EP-4.
- Cualquier recurso de cuentas (`hu-0013`).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- Agregado `LedgerTransaction` + handlers `RecordTransaction`/`AmendPendingTransaction`/
  `AnnotateTransaction`/`ConfirmTransaction`/`VoidPendingTransaction`/
  `ReverseConfirmedTransaction` — de `hu-0003`/`hu-0005`.
- Proyección `transaction_list` + query bus — de `hu-0006`.
- `CommandAcceptedDto`, patrón controller→bus, `@Context()`, `@ExternalRef()` — de
  `hu-0009`/`hu-0010`/`hu-0012`.
- Exception filter + códigos estables — de `hu-0011`.
- Referencia para filtros: `libs/shared/src/criteria/criteria-query.dto.ts` y
  `MovementController` de `apps/finances` (se opta por DTO tipado propio por claridad del contrato).

### Artefactos a crear
- `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`
- DTOs en `.../http/dto/`: `record-transaction-request` (+ `posting.dto`),
  `amend-transaction-request`, `annotate-transaction-request`, `confirm-transaction-request`,
  `void-transaction-request`, `reverse-transaction-request`, `transaction-query` (filtros +
  paginación), `transaction`, `transaction-list` (+ `index.ts`).
- `.../http/index.ts`.

### Patrones obligatorios
- Controller → command/query bus, sin lógica de dominio (RNF-10).
- Un verbo (sub-recurso POST) por transición de estado.
- Montos como decimal string; el dominio es la autoridad de invariantes.
- DTO tipado de filtros (`TransactionQueryDto`) por claridad del contrato OpenAPI.
- TDD estricto.

### Restricciones técnicas
- El cliente nunca envía `derivedKind` al crear; es filtro de lectura calculado por el proyector.
- `reverse` retorna el id de la reversa, no el de la original.
