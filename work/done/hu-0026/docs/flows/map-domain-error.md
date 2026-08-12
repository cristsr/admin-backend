---
use_case: map-domain-error
module: shared
trigger: rest
entrypoint: ALL /api/v1/*
command: cualquiera (fallo de dominio o de puerto durante el dispatch)
view: shared_http_map_domain_error
invariants: [RF-14, AC-3, AC-4, AC-5]
introduced_by: hu-0011
last_modified_by: hu-0026
status: active
---

# Map Domain Error (fallo de dominio/puerto → ErrorResponseBody)

Todo fallo de dominio o de puerto que ocurre durante el dispatch de un command o query
burbujea como `DomainException` hasta el `ExceptionFilter` global (registrado en `main.ts`,
implementado en `libs/shared`). El filter lee `exception.status` y `exception.code` y produce
el cuerpo uniforme `ErrorResponseBody`. No existe ningún `catch` especial por familia de
excepción. Un error no tipado se mapea a `500` **sin** `code` ni detalles internos.

**Delta hu-0026:** se suma `TRANSACTION_ALREADY_REVERSED` (409) a la tabla congelada. Es
aditivo — ningún código existente cambia de status — pero **reparte** un caso que hasta ahora
cubría `INVALID_TRANSACTION_STATE`: la doble reversa de una confirmada pasa a tener código
propio, y el código viejo se queda con el resto de los estados no reversables.

**Diagrama:** dynamic view `shared_http_map_domain_error` en [`../shared.c4`](../shared.c4).
Sin pasos nuevos: el código entra por el mismo camino del filter, como toda
`DomainConflictException`.

## Reglas

- **RF-14:** todo fallo de dominio/puerto responde con un `code` estable de la tabla y su
  status HTTP. El consumidor hace branching sobre `code`, nunca sobre `message`.
- **AC-3:** `TransactionAlreadyReversedException` extiende `DomainConflictException` — mismo
  filter, mismo camino, sin tratamiento especial. La lanza el agregado
  (`LedgerTransaction.reverse()`), no una política ni un puerto.
- **AC-4:** `LEDGER_ERROR_CODE`
  (`apps/ledger/src/shared/domain/errors/ledger-error-code.ts`) es la fuente única de los
  strings. Agregar un code es aditivo; cambiar el status de un code existente es **breaking**.
  hu-0026 agrega un code; no cambia el status de ninguno.
- **AC-5:** el mapeo está congelado por el contract test tabular
  (`ledger-error-code-mapping.spec.ts`), que ejecuta cada excepción a través del filter y
  afirma `{ statusCode, code }`. Agregar un code obliga a agregar su fila — hu-0026 agrega la
  de `TRANSACTION_ALREADY_REVERSED`.
- **409** para conflictos de **estado** del agregado/stream. La doble reversa es exactamente
  eso: el agregado ya tiene una reversa vinculada.

## Errores (tabla congelada RF-14)

Solo se listan las filas que hu-0026 agrega o modifica; el resto de la tabla queda intacto.

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| **NUEVO** — se intenta reversar una transacción que ya fue revertida (AC-3) | `TransactionAlreadyReversedException` | `TRANSACTION_ALREADY_REVERSED` | 409 |
| Transición de ciclo de vida inválida desde el estado actual, **excepto** la doble reversa | `InvalidTransactionStateException` | `INVALID_TRANSACTION_STATE` | 409 |

> **Nota sobre el reparto.** Antes de hu-0026, `INVALID_TRANSACTION_STATE` cubría dos
> condiciones distinguibles por el cliente solo leyendo el `message`: «no está CONFIRMED» y
> «ya está revertida». La segunda es accionable de otra forma (la corrección ya existe, hay
> que buscarla por `reverses_id`), así que gana su propio código. Queda **obsoleta** cualquier
> lectura que asuma que `INVALID_TRANSACTION_STATE` en el endpoint de reversa implica doble
> reversa.

## Respuesta

- **4xx de dominio/puerto:** `ErrorResponseBody { statusCode, error, message, code, path, timestamp }` —
  ver schemas `ErrorResponseBody` y `LedgerErrorCode` en [`../api.yaml`](../api.yaml).
- **500:** `ErrorResponseBody` sin `code` (la clave se omite del cuerpo).
