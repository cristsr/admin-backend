---
use_case: map-domain-error
module: shared
trigger: rest
entrypoint: ALL /api/v1/*
command: cualquiera (fallo de dominio o de puerto durante el dispatch)
view: shared_http_map_domain_error
invariants: [RF-14, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7]
introduced_by: hu-0011
last_modified_by: hu-0011
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

**Diagrama:** dynamic view `shared_http_map_domain_error` en [`../shared.c4`](../shared.c4).

## Reglas

- **RF-14:** todo fallo de dominio/puerto responde con un `code` estable de la tabla y
  su status HTTP; el cuerpo sigue `ErrorResponseBody`. El consumidor hace branching
  sobre `code`, nunca sobre `message`.
- **AC-1:** un único filter global (`@Catch()` de `libs/shared`) registrado en
  `main.ts` — no se escriben filters por módulo ni por familia.
- **AC-3:** las excepciones del puerto `EventStore` (`ConcurrencyConflictException`,
  `DuplicateExternalRefException`) extienden `DomainConflictException` — mismo filter,
  mismo camino.
- **AC-4:** `LEDGER_ERROR_CODE`
  (`apps/ledger/src/shared/domain/errors/ledger-error-code.ts`) es la fuente única de
  los strings. Agregar un code es aditivo; cambiar el status de un code existente es
  **breaking** (nueva versión del API).
- **AC-5:** el mapeo está congelado por un contract test tabular
  (`ledger-error-code-mapping.spec.ts`) que ejecuta cada excepción a través del filter
  y afirma `{ statusCode, code }`. Agregar un code obliga a agregar su fila.
- **AC-6:** un error no tipado → `500` sin `code` de dominio ni detalles internos.
- **AC-7:** el *replay* idempotente (mismo command, mismo `external_ref`) **no** es un
  error — lo resuelve EP-1 devolviendo el resultado original (200 downgrade vía
  `CommandResultInterceptor`). `DUPLICATE_EXTERNAL_REF` (409) se reserva para el caso
  patológico: mismo `external_ref` con un command distinto/conflictivo.
- **422** para violaciones semánticas del payload reprocesables corrigiéndolo.
- **409** para conflictos de **estado** del agregado/stream.
- **404** para recursos inexistentes dentro del scope del usuario.

## Errores (tabla congelada RF-14)

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| Postings no balancean a cero por moneda (INV-1) | `UnbalancedTransactionException` | `UNBALANCED_TRANSACTION` | 422 |
| Moneda no permitida para la cuenta | `CurrencyNotAllowedException` | `CURRENCY_NOT_ALLOWED` | 422 |
| Posting a cuenta cerrada (INV-3) — el cliente corrige eligiendo otra cuenta | `AccountClosedException` | `ACCOUNT_CLOSED` | 422 |
| Mutar una transacción ya confirmada | `ImmutableTransactionException` | `IMMUTABLE_TRANSACTION` | 409 |
| Nombre de cuenta duplicado en el mismo padre | `NameCollisionException` | `NAME_COLLISION` | 409 |
| Operación sobre cuenta de sistema protegida | `SystemAccountProtectedException` | `SYSTEM_ACCOUNT_PROTECTED` | 409 |
| Concurrencia optimista falló (INV-7) — retry contra estado fresco | `ConcurrencyConflictException` | `CONCURRENCY_CONFLICT` | 409 |
| Mismo `external_ref` con command distinto (caso patológico, INV-10) | `DuplicateExternalRefException` | `DUPLICATE_EXTERNAL_REF` | 409 |
| Transacción inexistente en el scope del usuario | `TransactionNotFoundException` | `TRANSACTION_NOT_FOUND` | 404 |
| Cuenta inexistente en el scope del usuario | `AccountNotFoundException` | `ACCOUNT_NOT_FOUND` | 404 |
| Ledger sin inicializar para el usuario | `LedgerNotInitializedException` | `LEDGER_NOT_INITIALIZED` | 422 |
| Código de moneda inutilizable (blank/formato) — VO shared-kernel y VO settings | `InvalidCurrencyCodeException` (ambas) | `INVALID_CURRENCY_CODE` | 422 |
| Timezone IANA inválida (settings) | `InvalidTimeZoneException` | `INVALID_TIME_ZONE` | 422 |
| Monto no es un decimal válido (o `number`, INV-8) | `InvalidMoneyException` | `INVALID_MONEY` | 422 |
| Operación entre monedas distintas | `CurrencyMismatchException` | `CURRENCY_MISMATCH` | 422 |
| Escala del monto excede `minor_units` de la moneda | `MoneyScaleException` | `MONEY_SCALE` | 422 |
| `Currency` mal construida (code blank o `minor_units` inválido) | `InvalidCurrencyException` | `INVALID_CURRENCY` | 422 |
| Error no tipado (bug, fallo de infraestructura) | `Error` y cualquier no-`DomainException` | — (no se expone) | 500 |

## Respuesta

- **4xx de dominio/puerto:** `ErrorResponseBody { statusCode, error, message, code, path, timestamp }` —
  ver schemas `ErrorResponseBody` y `LedgerErrorCode` en [`../api.yaml`](../api.yaml).
- **500:** `ErrorResponseBody` sin `code` (la clave se omite del cuerpo).
