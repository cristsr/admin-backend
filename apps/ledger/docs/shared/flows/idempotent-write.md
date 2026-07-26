---
use_case: idempotent-write
module: shared
trigger: rest
entrypoint: POST /api/v1/* (con X-External-Ref)
command: varies (cualquier command con AuthContext.externalRef)
view: shared_http_idempotent_write
invariants: [AC-1, AC-2, AC-3, AC-4, AC-5, INV-10, RF-11, RNF-9]
introduced_by: hu-0012
last_modified_by: hu-0012
status: active
---

# Escritura idempotente y read-your-writes (RF-11 / RNF-9)

Cómo el borde HTTP transporta el `external_ref`, cómo el `CommandBus` lo convierte en
idempotencia, y por qué un `GET` inmediato después de un `2xx` ya ve la escritura.

El ledger **no** replica el `IdempotencyInterceptor` de `finances` ni su tabla propia: el
borde HTTP solo transporta el valor y la semántica vive en el puerto `EventStore`,
respaldada por el índice único `(user_id, external_ref)`.

**Diagrama:** dynamic view `shared_http_idempotent_write` en [`../shared.c4`](../shared.c4).

## Recorrido

1. **`@ExternalRef()`** (`external-ref.decorator.ts`) extrae la clave: header
   `X-External-Ref` preferido, fallback a `external_ref` del body, `null` si ninguno es un
   string no vacío. Ambas fuentes se recortan con `trim()`; un header repetido llega como
   array y **no** se acepta (solo `typeof === 'string'`).
2. El **controller** lo pasa al `dispatch` dentro del `AuthContext`. No decide nada.
3. **`IdempotencyPolicy`** (segunda del chain, tras `AuthenticatedContextPolicy`):
   - Sin `externalRef` → sigue de largo, sin idempotencia.
   - Con `externalRef` → busca el evento ancla con
     `EventStore.findByExternalRef(userId, externalRef)`. Si existe, **replaya**: devuelve
     `{ aggregateId, streamPosition, idempotentReplay: true }` del ancla, sin ejecutar el
     handler ni emitir eventos.
   - Si no existe, ejecuta el handler. Si el índice único rechaza la escritura por una
     carrera concurrente (`DuplicateExternalRefException`), atrapa el error, relee el ancla
     y replaya igual.
4. **`CommandResultInterceptor`** estampa `X-Ledger-Stream-Position` y, cuando
   `idempotentReplay === true`, degrada el status a `200`.

## Reglas

- **AC-1:** El header gana sobre el body. `null` cuando ninguno está presente; el
  `external_ref` es opcional hoy (sin registro de clientes, §2.10, no se exige por
  `client_id`).
- **AC-2 (INV-10 / RNF-4):** Dos escrituras con el mismo `external_ref` emiten eventos una
  sola vez; la segunda devuelve el **mismo** `aggregateId` y `streamPosition`, con status
  `200`.
- **AC-3:** `IdempotencyPolicy` **no compara el command** (su primer parámetro es
  `_command`). Reenviar el mismo `external_ref` con un command distinto replaya el
  resultado original en vez de rechazarlo: el `external_ref` es una **clave de reintento
  del cliente**, no un detector de colisiones. Ver la nota de `DUPLICATE_EXTERNAL_REF` en
  [`map-domain-error.md`](./map-domain-error.md).
- **AC-4 (RNF-9):** Toda escritura de los controllers de EP-2 expone `streamPosition` en el
  body (`CommandAcceptedDto`) y en el header `X-Ledger-Stream-Position`. El interceptor es
  **opt-in por controller** (`@UseInterceptors`), no `APP_INTERCEPTOR`: lo declaran
  `AccountsController`, `LedgerController` y `TransactionsController`; los controllers de
  EP-3 ya montados (`BalanceAssertionController`, `TransferController`) no.
- **AC-5:** Read-your-writes por proyección **inline**: cada handler hace
  `repository.save(...)` y luego `dispatcher.dispatch(result.events)` dentro del mismo
  request, antes de responder. Las dos operaciones son secuenciales pero **no comparten
  transacción** — no existe `UnitOfWork` entre `EventStore` y `ReadModelStore`. Si la
  proyección falla tras un append exitoso, el evento queda persistido y la vista
  desactualizada hasta el próximo rebuild (`hu-0008`).
- **No implementado:** `min_position` / `X-Ledger-Min-Position` no existen (cero
  ocurrencias en `apps/ledger/src`). La espera activa por checkpoint pertenece a EP-3,
  cuando exista la primera proyección eventualmente consistente.

## Errores

| Condición | Resultado | HTTP |
|---|---|---|
| `external_ref` ausente | Sin idempotencia; el command corre normal | 201 |
| `external_ref` repetido, mismo command | Replay del `CommandResult` original | 200 |
| `external_ref` repetido, command distinto | Replay del original (**no** 409) | 200 |
| Carrera concurrente sobre el índice único | `DuplicateExternalRefException` atrapada → replay | 200 |
| Ancla reportada duplicada pero ausente al releer | `DuplicateExternalRefException` propagada (bug de consistencia) | 409 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` + `X-Ledger-Stream-Position`.
- **200:** Idéntico cuerpo y header, con `idempotentReplay` interno en `true`. El cliente
  distingue el replay por el status, no por el body.
