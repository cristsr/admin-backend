---
use_case: map-domain-error
module: shared
trigger: rest
entrypoint: ALL /api/v1/*
command: cualquiera (fallo de dominio o de puerto durante el dispatch)
view: shared_http_map_domain_error
invariants: [RF-14, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8]
introduced_by: hu-0011
last_modified_by: hu-0025
status: active
---

# Map Domain Error (fallo de dominio/puerto → ErrorResponseBody)

Todo fallo de dominio o de puerto que ocurre durante el dispatch de un command o query
burbujea como `DomainException` hasta el `ExceptionFilter` global (registrado en
`main.ts`, implementado en `libs/shared`). El filter lee `exception.status` y
`exception.code` y produce el cuerpo uniforme `ErrorResponseBody`
(`{ statusCode, error, message, code, path, timestamp }`). No existe ningún `catch`
especial por familia de excepción: las excepciones de puerto (`CONCURRENCY_CONFLICT`,
`DUPLICATE_EXTERNAL_REF`) extienden la misma jerarquía `DomainException` y se mapean
por el mismo camino. Un error no tipado se mapea a `500` **sin** `code` ni detalles
internos.

**Delta hu-0025 (AC-5):** se suma `PERSISTENCE_CONFLICT` (409) a la tabla congelada. El
fallo transitorio del motor (deadlock `40P01`/serialization `40001`) ya no llega al filter
como `QueryFailedError` crudo (→ 500 sin `code`): `PostgresEventStore.translate()` lo
convierte en `TransientPersistenceException`, `RetryPolicy` lo reintenta y, al agotar los
3 intentos, lanza `PersistenceConflictException` con código estable.

**Diagrama:** dynamic view `shared_http_map_domain_error` en [`../shared.c4`](../shared.c4).

## Reglas

- **RF-14:** todo fallo de dominio/puerto responde con un `code` estable de la tabla y
  su status HTTP; el cuerpo sigue `ErrorResponseBody`. El consumidor hace branching
  sobre `code`, nunca sobre `message`.
- **AC-1:** un único filter global (`@Catch()` de `libs/shared`) registrado en
  `main.ts` — no se escriben filters por módulo ni por familia.
- **AC-3:** las excepciones del puerto `EventStore` (`ConcurrencyConflictException`,
  `DuplicateExternalRefException`) extienden `DomainConflictException` — mismo filter,
  mismo camino. `IdempotencyInputMismatchException` (hu-0024) y
  `PersistenceConflictException` (hu-0025) extienden la misma clase y entran por el
  mismo camino, aunque las lancen políticas y no el puerto.
- **AC-4:** `LEDGER_ERROR_CODE`
  (`apps/ledger/src/shared/domain/errors/ledger-error-code.ts`) es la fuente única de
  los strings. Agregar un code es aditivo; cambiar el status de un code existente es
  **breaking** (nueva versión del API).
- **AC-5:** el mapeo está congelado por un contract test tabular
  (`ledger-error-code-mapping.spec.ts`) que ejecuta cada excepción a través del filter
  y afirma `{ statusCode, code }`. Agregar un code obliga a agregar su fila — hu-0025
  agrega la de `PERSISTENCE_CONFLICT`.
- **AC-6:** un error no tipado → `500` sin `code` de dominio ni detalles internos.
- **AC-7 — reescrita por hu-0024.** El *replay* idempotente (misma `external_ref`, **mismos
  inputs**) no es un error: lo resuelve EP-1 devolviendo el resultado original (200 downgrade +
  `Idempotency-Hit: true` vía `CommandResultInterceptor`). El caso patológico —misma
  `external_ref` con **inputs distintos**— ya no es un replay silencioso: es
  `IDEMPOTENCY_INPUT_MISMATCH` (409).
- **AC-5 (hu-0025):** `TransientPersistenceException` **no se lista** en la tabla: es
  transitoria por diseño, nunca llega al API — o se reintenta o se convierte en
  `PERSISTENCE_CONFLICT`.
- **422** para violaciones semánticas del payload reprocesables corrigiéndolo.
- **409** para conflictos de **estado** del agregado/stream, para el reuso de una clave de
  idempotencia con datos distintos, y para el agotamiento de reintentos transitorios.
- **404** para recursos inexistentes dentro del scope del usuario.

## Errores (tabla congelada RF-14)

Solo se listan las filas que hu-0025 agrega o modifica; el resto de la tabla queda intacto.

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| **NUEVO** — transitorio del motor (40P01/40001) agotó los 3 intentos (AC-5) | `PersistenceConflictException` | `PERSISTENCE_CONFLICT` | 409 |
| Misma `external_ref` del usuario con inputs distintos (hu-0024) | `IdempotencyInputMismatchException` | `IDEMPOTENCY_INPUT_MISMATCH` | 409 |
| Conflicto de agregado — **nunca reintentado por RetryPolicy** (AC-6) | `ConcurrencyConflictException` | `CONCURRENCY_CONFLICT` | 409 |

> **Nota sobre los códigos de conflicto (hu-0025).** Los tres conviven en el mismo 409 con
> reparto por capa:
>
> - **`PERSISTENCE_CONFLICT` (409)** es el contrato de `RetryPolicy`: fallo transitorio del
>   motor agotado. Es la única de las tres que puede emitirse en cualquier escritura, con o
>   sin `external_ref`.
> - **`IDEMPOTENCY_INPUT_MISMATCH` (409)** es el contrato de `IdempotencyPolicy` (hu-0024):
>   reuso de `external_ref` con inputs distintos.
> - **`CONCURRENCY_CONFLICT` (409)** sigue siendo el contrato de
>   `OptimisticConcurrencyPolicy`/puerto (INV-7): el agregado avanzó; se propaga como hoy
>   (AC-6), tras el retry-once existente con reload.

## Respuesta

- **4xx de dominio/puerto:** `ErrorResponseBody { statusCode, error, message, code, path, timestamp }` —
  ver schemas `ErrorResponseBody` y `LedgerErrorCode` en [`../api.yaml`](../api.yaml).
- **500:** `ErrorResponseBody` sin `code` (la clave se omite del cuerpo).
